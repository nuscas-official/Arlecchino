# Concurrent Quiz Platform — Implementation Plan

**Deliverable:** A live quiz for ~200 concurrent participants. 50–100 image-bearing MCQs, single submission at the end, hard time limit with auto-submit, leaderboard ranked by score then elapsed time.

This document is the spec. Build it in the phase order given. Do not start a phase until the previous phase's acceptance criteria pass.

---

## 0. Fixed decisions

These are settled. Do not re-litigate them mid-build; if one turns out to be wrong, stop and flag it.

| Concern | Decision |
|---|---|
| Frontend | React + Vite, static build, deployed to Cloudflare Pages |
| API | Hono on Cloudflare Workers |
| Database | Neon Postgres, accessed via `@neondatabase/serverless` (HTTP driver) |
| Grading | **Server-side only.** The answer key never reaches the client. |
| Timing | Server-issued `started_at`; elapsed computed server-side at submission |
| Load test | k6, run against the deployed API before the frontend is built |
| State recovery | `localStorage` on the client, plus optional server-side progress autosave |

**Why the Neon HTTP driver specifically:** it issues one-shot queries over `fetch` with no persistent connection, which sidesteps connection-pool exhaustion. 200 simultaneous Workers invocations each grabbing a pooled TCP connection against a 20-connection Postgres limit is the single most likely way this system fails under load. The HTTP driver makes that failure mode structurally impossible.

**Acceptable substitutions** if the above is unavailable: Cloudflare D1 (SQLite, no pooling concept) or Supabase. Do **not** substitute a conventional `pg` Pool on a serverless runtime.

---

## 1. Data model

```sql
create table quiz (
  id            text primary key,
  title         text not null,
  duration_ms   integer not null,      -- e.g. 2400000 for 40 min
  grace_ms      integer not null default 60000,
  opens_at      timestamptz,
  closes_at     timestamptz
);

create table question (
  id            text primary key,
  quiz_id       text not null references quiz(id),
  position      integer not null,
  prompt        text not null,
  image_url     text,
  options       jsonb not null,        -- [{key:"a", label:"..."}, ...]
  correct_key   text not null,         -- NEVER serialized to participants
  points        integer not null default 1,
  unique (quiz_id, position)
);

create table participant (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       text not null references quiz(id),
  display_name  text not null,
  session_token text not null unique,
  started_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table submission (
  participant_id uuid primary key references participant(id),
  answers        jsonb not null,       -- {"q1":"b","q7":"d",...} sparse; unanswered omitted
  score          integer not null,
  correct_count  integer not null,
  answered_count integer not null,
  elapsed_ms     integer not null,
  auto_submitted boolean not null default false,
  was_late       boolean not null default false,
  submitted_at   timestamptz not null default now()
);

create index on submission (score desc, elapsed_ms asc);
```

Notes:

- `submission.participant_id` is the **primary key**, not a serial. This is the idempotency guarantee: a duplicate submission cannot create a second row, it can only conflict. Everything else about retry safety follows from this one constraint.
- Answers live in a single `jsonb` column. One row written per participant, not one per answer. 200 total writes, not 20,000.
- `correct_key` lives only here. It must never appear in any response body sent to a participant.

---

## 2. API

### `POST /api/session/start`

Request: `{ quizId, displayName }`

Response: `{ participantId, sessionToken, startedAt, deadline, durationMs }`

- Generates a session token (random 32 bytes, base64url). Client stores it and sends it as `Authorization: Bearer <token>` thereafter.
- `startedAt` is `now()` from the database, not from the client.
- `deadline = startedAt + duration_ms`. Return it so the client can render a countdown, but treat the client's copy as advisory only.
- If a `displayName` + `quizId` pair already has a participant row and no submission, return the existing session rather than creating a second one. This makes "I closed the tab" recoverable.

### `GET /api/quiz/:quizId`

Requires a valid session token.

Returns questions ordered by `position`, each with `id`, `prompt`, `imageUrl`, `options`, `points`.

**Explicitly select columns.** Do not `select *` and then delete `correct_key` in JavaScript — that pattern leaks the moment someone adds a field or refactors the serializer. Write the column list out.

### `POST /api/submit`

Requires a valid session token.

Request: `{ answers: { [questionId]: optionKey }, autoSubmitted: boolean }`

Behaviour:

1. Load the participant row, get `started_at`.
2. `elapsed = now() - started_at`.
3. If `elapsed > duration_ms + grace_ms` → reject with `410 Gone`.
4. If `elapsed > duration_ms` → accept, set `was_late = true`, clamp `elapsed_ms` to `duration_ms`.
5. Grade against `correct_key`. Ignore any submitted key that doesn't match a real question in this quiz.
6. `insert ... on conflict (participant_id) do nothing`, then read back the stored row and return it.

Response: `{ score, correctCount, answeredCount, elapsedMs, alreadySubmitted: boolean }`

Step 6 is what makes the endpoint safe to retry. A client that times out, retries, and succeeds gets the *first* submission's result back, with `alreadySubmitted: true`. It never double-counts and never gets a confusing "you already submitted" error.

### `GET /api/leaderboard/:quizId`

Public. `order by score desc, elapsed_ms asc, submitted_at asc`. Returns `displayName`, `score`, `elapsedMs`, `rank`. Cache for 5–10 seconds — 200 people refreshing a leaderboard is more traffic than the submission spike.

### `POST /api/admin/quiz`

Bearer-token protected with a secret from the environment. Accepts a full quiz definition as JSON and upserts it. Keeps question authoring out of the codebase.

---

## 3. Load test — build this before the frontend

The point of this phase is not "does the server respond." It is **does the data survive a simultaneous spike.** Latency is the least interesting output.

Deploy the API to its real URL first. Do not load-test `localhost`: it hides TLS handshake cost, cold starts, and real network latency, which together are most of what you're measuring.

### Shape of the test

Use k6's `constant-arrival-rate` executor to fire 200 iterations inside one second. This models an auto-submit spike. Do **not** use a ramping profile — real traffic here is a cliff, not a curve.

```js
export const options = {
  scenarios: {
    spike: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '1s',
      preAllocatedVUs: 200,
      maxVUs: 250,
    },
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<1500'],
  },
};
```

In `setup()`, create 200 participant sessions sequentially and return the tokens. Each VU then submits with its own token. Session creation is not the thing under test; the simultaneous write is.

**Use a realistic payload.** 100 answers is roughly 4–8 KB. Testing with `{}` measures nothing useful about serialization or parse cost.

### Acceptance criteria

All of these must pass before writing frontend code:

- [ ] Exactly **200** rows in `submission`. Not 199, not 203.
- [ ] Zero non-2xx responses.
- [ ] p95 latency under 1500 ms, p99 under 3000 ms.
- [ ] **Re-run the identical test against the same 200 participants.** Row count is still exactly 200. Every response carries `alreadySubmitted: true`.
- [ ] Spot-check 10 rows: `score` matches a hand-graded count of that VU's answers.
- [ ] Run the spike again **after 15+ minutes of idle** to measure cold-start behaviour. First-spike numbers are the ones that matter — you get one shot at the real event.
- [ ] Kill the test mid-flight and confirm no partially-written or malformed `answers` JSON.

If generating load from one laptop, watch for ephemeral port exhaustion and uplink saturation — at 200 VUs you're fine, but if numbers look strange, verify you're not measuring your own NIC.

---

## 4. Frontend

Static React, one question per screen.

### Timer and auto-submit

- Countdown derived from the server's `deadline`, not from a client-side `setTimeout` started at page load. Tabs get backgrounded and timers get throttled; recompute from wall-clock on every tick and on `visibilitychange`.
- At `deadline`, fire auto-submit with `autoSubmitted: true`.
- Add **0–15 s of random jitter** to the auto-submit. The backend can take the spike without it, but it costs one line and it flattens the peak for free.
- Show a visible warning at T-5 minutes and T-1 minute.

### Submission reliability

Retry on network error or 5xx: exponential backoff, roughly 1 s / 2 s / 4 s / 8 s / 16 s, up to ~90 seconds. The same payload every time — idempotency on the server makes this safe.

Do not clear `localStorage` until a 2xx comes back. If all retries fail, keep the answers on disk and show a "Retry submission" button rather than a dead end.

### Refresh survival

Write the answer map to `localStorage` on every selection, keyed by `participantId`. Rehydrate on mount. Someone 80 questions deep who reloads by accident must not lose their work — this is cheap to build and expensive to skip.

### Images

Images are **per-question optional**. `question.image_url` is nullable and a null means the question renders as text only. Build for the worst case anyway: assume all 100 questions carry an image, because that's the load profile you have to survive.

**Budget.** At 60–80 KB each, 100 images is roughly 6–8 MB per participant. Spread across a 40-minute quiz that's nothing. The problem is the first ten seconds, when 200 people simultaneously load the opening questions — 200 × 5 images × 80 KB ≈ 80 MB in a burst, which on shared venue wifi is a visible stall.

- **Warm the cache before the clock starts.** Prefetch the first 5–8 images during the name-entry screen, while `started_at` has not yet been issued. This is the single highest-value optimization here: it moves the worst burst outside the timed window, where it costs nobody any score.
- Convert to WebP, target 60–80 KB, max 1200 px on the long edge.
- Serve from CDN with long `Cache-Control` and content-hashed filenames.
- Prefetch a rolling window of the next 3–5 **image-bearing** questions — skip nulls when counting, or a run of text-only questions will silently shrink your lookahead to zero.
- Never block option rendering on image load. A participant must be able to read and answer while the image is still arriving; a slow image should cost them nothing they can't recover.
- Set explicit `width`/`height` to prevent layout shift.
- Give every image real alt text. If an image is load-bearing for the answer, the alt text cannot give the answer away — describe it, don't solve it.
- Handle image load failure: show a "couldn't load image" placeholder with a retry, not a broken-image icon. A participant who can't see the image needs to know it's a network problem, not a trick question.

### Layout stability across mixed questions

If some questions have images and some don't, the answer options shift vertically between questions. Under time pressure at 100 questions, that produces real misclicks.

Anchor the option list to a fixed position in the viewport regardless of whether an image is present. Either reserve a consistent media area, or pin the options block and let the prompt/media area flex above it. Verify by tabbing through a text-only question followed by an image question and confirming the first option does not move.

### Interface copy

Buttons name what happens: "Submit quiz," not "Submit." The action keeps its name through the flow — the button that says "Submit quiz" produces a confirmation that says "Quiz submitted." Errors say what went wrong and what to do next: "Couldn't reach the server — retrying automatically. Your answers are saved." Never a bare "Error."

### Accessibility floor

Keyboard navigable, visible focus rings, options as real radio inputs in a `fieldset` with a `legend`, `prefers-reduced-motion` respected. Works down to 360 px wide — expect phones.

---

## 5. Hardening

- **Rate limit** `/api/session/start` by IP. It's the only unauthenticated write.
- **Validate everything** with Zod at the API boundary. Reject oversized bodies (cap around 64 KB).
- **CORS** locked to the Pages origin, not `*`.
- **Structured logging** on every submission: participant id, elapsed, score, retry count, late flag. When something goes wrong during the live event you will have exactly one chance to understand it from the logs.
- **Admin export**: `GET /api/admin/export/:quizId` returning CSV. This is where the Google Sheets workflow comes back — export once, afterwards, instead of making a spreadsheet absorb 200 concurrent writes.
- **Optional progress autosave**: `POST /api/progress` every 30 s. 200 clients × every 30 s is under 7 req/s — trivial load, and it covers the laptop-dies-at-question-90 case that `localStorage` can't.

---

## 6. Pre-event checklist

- [ ] Full dry run with 10–20 real humans on the actual venue network.
- [ ] Load test re-run against **production** config, from cold.
- [ ] Confirm the answer key is absent from the JS bundle: build, then `grep` the output for a known correct answer string.
- [ ] Verify the leaderboard sorts correctly with deliberately tied scores.
- [ ] Confirm timezone handling — everything in UTC internally, formatted at the edge.
- [ ] Decide and document the tiebreak beyond `elapsed_ms`.
- [ ] Have a manual "close quiz and force-grade" admin action ready.
- [ ] Know how to read the logs *before* you need to.
- [ ] Verify every `image_url` resolves — a 404 discovered live is unfixable mid-quiz.
- [ ] Check total image payload on a throttled connection (Fast 3G in devtools) end to end.
- [ ] Confirm option position doesn't shift between an image question and a text-only one.

---

## Anti-goals

Things not to build, stated explicitly so the agent doesn't add them:

- No per-question submission. One write per participant.
- No client-side grading, not even "just for the progress indicator."
- No hashing the answer key into the bundle. With 4 options per question it is brute-forced in milliseconds.
- No ranking by row arrival order or `submitted_at` alone — that makes network queueing delay the tiebreaker instead of speed.
- No conventional connection pool on a serverless runtime.
- No websockets, no live presence, no real-time sync. Not needed here.
