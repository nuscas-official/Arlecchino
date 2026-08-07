import { dbService } from '../server/db.js';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const QUIZ_ID = 'arlecchino-riddles-1';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'arlecchino-secret-key';

async function runSpikeVerification() {
  console.log('---------------------------------------------------------');
  console.log('🏆 Arlecchino Load, Host Control & Idempotency Suite');
  console.log('---------------------------------------------------------');

  // Step 0: Unlock Quiz via Admin API
  console.log('\n[0/4] Unlocking quiz via Admin Control API...');
  const unlockRes = await fetch(`${BASE_URL}/api/admin/quiz/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ quizId: QUIZ_ID, status: 'active' }),
  });

  if (!unlockRes.ok) {
    throw new Error(`Failed to unlock quiz via Admin API: status ${unlockRes.status}`);
  }
  console.log('✅ Quiz unlocked by Host! Status: ACTIVE');

  // Step 1: Pre-create 200 participant sessions
  console.log('\n[1/4] Registering 200 participant sessions sequentially...');
  const runId = Date.now();
  const sessions: Array<{ id: string; token: string; name: string }> = [];

  for (let i = 1; i <= 200; i++) {
    const name = `LoadTest-${runId}-Participant-${i}`;
    const res = await fetch(`${BASE_URL}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: QUIZ_ID, displayName: name }),
    });

    if (!res.ok) {
      throw new Error(`Failed session start for ${name}: status ${res.status}`);
    }

    const data = (await res.json()) as any;
    sessions.push({
      id: data.participantId,
      token: data.sessionToken,
      name,
    });
  }
  console.log(`✅ Created ${sessions.length} participant sessions.`);

  // Step 2: Fire 200 SIMULTANEOUS submission requests using Promise.all
  console.log('\n[2/4] Firing 200 simultaneous submission POST requests (Spike)...');
  const startBurst = Date.now();

  const submitPromises = sessions.map((session) => {
    const answers: Record<string, string> = {};
    for (let q = 1; q <= 50; q++) {
      answers[`q-${q}`] = ['a', 'b', 'c', 'd'][q % 4];
    }

    return fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ answers, autoSubmitted: true }),
    }).then(async (res) => {
      const body = await res.json();
      return { status: res.status, body };
    });
  });

  const results = await Promise.all(submitPromises);
  const durationMs = Date.now() - startBurst;

  console.log(`⚡ 200 concurrent submissions finished in ${durationMs}ms`);

  const non2xx = results.filter((r) => r.status !== 200);
  console.log(`  - Total HTTP responses: ${results.length}`);
  console.log(`  - Non-200 responses: ${non2xx.length}`);

  if (non2xx.length > 0) {
    console.error('❌ Failed! Non-200 responses detected:', non2xx.slice(0, 3));
    process.exit(1);
  }

  const leaderboard = dbService.getLeaderboard(QUIZ_ID, 10000);
  const testSessionIds = new Set(sessions.map((s) => s.id));
  const testSubmissions = leaderboard.filter((r) => sessions.some((s) => s.name === r.displayName));
  console.log(`  - DB Submission rows recorded for this test run: ${testSubmissions.length}`);

  if (testSubmissions.length !== 200) {
    console.error(`❌ Failed! Expected exactly 200 rows in DB, found ${testSubmissions.length}`);
    process.exit(1);
  }
  console.log('✅ Exactly 200 rows recorded in DB!');

  // Step 3: Re-fire the EXACT SAME 200 submissions to test primary-key idempotency
  console.log('\n[3/4] Re-firing identical 200 submission requests to test IDEMPOTENCY...');
  const retryPromises = sessions.map((session) => {
    const answers: Record<string, string> = {};
    for (let q = 1; q <= 50; q++) {
      answers[`q-${q}`] = ['a', 'b', 'c', 'd'][q % 4];
    }

    return fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ answers, autoSubmitted: true }),
    }).then(async (res) => {
      const body = (await res.json()) as any;
      return { status: res.status, body };
    });
  });

  const retryResults = await Promise.all(retryPromises);
  const alreadySubmittedCount = retryResults.filter((r) => r.body.alreadySubmitted === true).length;
  console.log(`  - Retry responses carrying 'alreadySubmitted: true': ${alreadySubmittedCount}/200`);

  const leaderboardAfterRetry = dbService.getLeaderboard(QUIZ_ID, 10000);
  const testSubmissionsAfterRetry = leaderboardAfterRetry.filter((r) => sessions.some((s) => s.name === r.displayName));
  console.log(`  - DB Submission rows after retry: ${testSubmissionsAfterRetry.length}`);

  if (alreadySubmittedCount !== 200 || testSubmissionsAfterRetry.length !== 200) {
    console.error('❌ Idempotency failed!');
    process.exit(1);
  }
  console.log('✅ Idempotency test PASSED! Zero duplicate rows created.');

  // Step 4: Leaderboard Spot Check
  console.log('\n[4/4] Leaderboard Spot Check (Top 3):');
  leaderboard.slice(0, 3).forEach((entry) => {
    console.log(`  Rank #${entry.rank}: ${entry.displayName} | Score: ${entry.score} | Elapsed: ${entry.elapsedMs}ms`);
  });

  console.log('\n✨ ALL HOST CONTROL & LOAD TEST CRITERIA PASSED! ✨\n');
}

runSpikeVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
