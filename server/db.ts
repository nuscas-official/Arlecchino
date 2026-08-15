import { neon } from '@neondatabase/serverless';
import { createRequire } from 'node:module';
import path from 'node:path';

export interface Quiz {
  id: string;
  title: string;
  duration_ms: number;
  grace_ms: number;
  status: 'locked' | 'active' | 'finished';
  opens_at?: string | null;
  closes_at?: string | null;
}

export interface Question {
  id: string;
  quiz_id: string;
  position: number;
  prompt: string;
  image_url?: string | null;
  options: Array<{ key: string; label: string }>;
  correct_key: string;
  points: number;
}

export interface QuestionPublic {
  id: string;
  quizId: string;
  position: number;
  prompt: string;
  imageUrl?: string | null;
  options: Array<{ key: string; label: string }>;
  points: number;
}

export interface Participant {
  id: string;
  quiz_id: string;
  display_name: string;
  session_token: string;
  started_at: string;
  created_at: string;
}

export interface Submission {
  participant_id: string;
  answers: Record<string, string>;
  score: number;
  correct_count: number;
  answered_count: number;
  elapsed_ms: number;
  auto_submitted: boolean;
  was_late: boolean;
  submitted_at: string;
}

export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  code: string;
  score: number;
  elapsedMs: number;
  rank: number;
  submittedAt: string;
  wasLate: boolean;
}

/**
 * Short public tag for a participant. Display names are free text and collide
 * constantly ("John", "John"); this never does, so it is what disambiguates
 * two people on the leaderboard and in the CSV export.
 */
export function participantCode(participantId: string): string {
  return participantId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
}

/**
 * True for the empty 0-score row written by forceGradeAllUnsubmitted. It is a
 * floor, not a real answer sheet, so a genuine submission may overwrite it.
 */
export function isPlaceholderSubmission(sub?: Submission): boolean {
  return Boolean(sub && sub.auto_submitted && sub.answered_count === 0);
}

// Question order is randomized per participant, but that now happens in the
// browser (src/services/questionShuffler.ts). Shuffling here made every
// response participant-specific, which is what made it impossible to cache the
// question set at the edge. The order was never a secret — the client receives
// all questions in one payload either way — and `correct_key` is still never
// sent, so grading integrity is unaffected.

// Helper to generate UUID & random base64url tokens across WebCrypto & Node
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'p-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function generateToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Neon HTTP DB Driver (Production Cloudflare Workers / Serverless)
 */
function getNeonSql(envDatabaseUrl?: string) {
  const dbUrl = envDatabaseUrl || (typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined);
  if (!dbUrl) return null;
  return neon(dbUrl);
}

/**
 * Schema migration. Deliberately NOT on the request path.
 *
 * This used to run from getQuiz behind a module-level `neonTablesCreated` flag,
 * but module state in a Worker is per-ISOLATE, not per-deployment: the flag
 * means "this isolate has run the DDL", never "the database has the tables".
 * A 200-person join burst spins up isolates, so each one re-ran the block —
 * and `ALTER TABLE ... ADD COLUMN` takes an ACCESS EXCLUSIVE lock on `quiz`
 * even when the column already exists, i.e. the strongest lock Postgres has,
 * on the hottest table, at the exact moment of peak read traffic.
 *
 * Errors now propagate instead of being swallowed. The old catch left the flag
 * false, so one transient failure meant that isolate re-ran all six statements
 * on every subsequent request, forever, while only logging.
 *
 * Called once from seedArlecchinoQuiz (i.e. from POST /api/admin/seed).
 */
export async function ensureNeonTables(sql: any) {
  await sql`CREATE TABLE IF NOT EXISTS quiz (id TEXT PRIMARY KEY, title TEXT NOT NULL, duration_ms INTEGER NOT NULL, grace_ms INTEGER NOT NULL DEFAULT 60000, status TEXT NOT NULL DEFAULT 'locked', opens_at TEXT, closes_at TEXT);`;
  await sql`ALTER TABLE quiz ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'locked';`;
  await sql`CREATE TABLE IF NOT EXISTS question (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL REFERENCES quiz(id), position INTEGER NOT NULL, prompt TEXT NOT NULL, image_url TEXT, options JSONB NOT NULL, correct_key TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 1, UNIQUE (quiz_id, position));`;
  await sql`CREATE TABLE IF NOT EXISTS participant (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL REFERENCES quiz(id), display_name TEXT NOT NULL, session_token TEXT NOT NULL UNIQUE, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`;
  await sql`CREATE TABLE IF NOT EXISTS submission (participant_id TEXT PRIMARY KEY REFERENCES participant(id), answers JSONB NOT NULL, score INTEGER NOT NULL, correct_count INTEGER NOT NULL, answered_count INTEGER NOT NULL, elapsed_ms INTEGER NOT NULL, auto_submitted BOOLEAN NOT NULL DEFAULT false, was_late BOOLEAN NOT NULL DEFAULT false, submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_submission_leaderboard ON submission (score DESC, elapsed_ms ASC, submitted_at ASC);`;
}

/** Exposed so the seed path can reach the same connection helper. */
export function neonSqlFor(envDatabaseUrl?: string) {
  return getNeonSql(envDatabaseUrl);
}

/**
 * SQLite Local Driver (Local Node dev environment fallback)
 */
let localDbInstance: any = null;
function getLocalSqlite() {
  if (localDbInstance) return localDbInstance;
  try {
    const req = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
    const Database = req('better-sqlite3');
    const dbPath = path.resolve(process.cwd(), 'arlecchino.db');
    localDbInstance = new Database(dbPath);
    localDbInstance.pragma('journal_mode = WAL');

    localDbInstance.exec(`
      CREATE TABLE IF NOT EXISTS quiz (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        grace_ms INTEGER NOT NULL DEFAULT 60000,
        status TEXT NOT NULL DEFAULT 'locked',
        opens_at TEXT,
        closes_at TEXT
      );
      CREATE TABLE IF NOT EXISTS question (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL REFERENCES quiz(id),
        position INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        image_url TEXT,
        options TEXT NOT NULL,
        correct_key TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 1,
        UNIQUE (quiz_id, position)
      );
      CREATE TABLE IF NOT EXISTS participant (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL REFERENCES quiz(id),
        display_name TEXT NOT NULL,
        session_token TEXT NOT NULL UNIQUE,
        started_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE TABLE IF NOT EXISTS submission (
        participant_id TEXT PRIMARY KEY REFERENCES participant(id),
        answers TEXT NOT NULL,
        score INTEGER NOT NULL,
        correct_count INTEGER NOT NULL,
        answered_count INTEGER NOT NULL,
        elapsed_ms INTEGER NOT NULL,
        auto_submitted INTEGER NOT NULL DEFAULT 0,
        was_late INTEGER NOT NULL DEFAULT 0,
        submitted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_submission_leaderboard ON submission (score DESC, elapsed_ms ASC, submitted_at ASC);
    `);

    try {
      localDbInstance.exec("ALTER TABLE quiz ADD COLUMN status TEXT NOT NULL DEFAULT 'locked'");
    } catch (e) {}

    return localDbInstance;
  } catch (err) {
    console.error('[getLocalSqlite ERROR]', err);
    return null;
  }
}

export const dbService = {
  async getQuiz(quizId: string, envDbUrl?: string): Promise<Quiz | undefined> {
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      // No lazy migration and no auto-seed here. Both used to run inline: on an
      // empty database 200 concurrent joins each started their own full seed
      // (51 sequential round trips apiece) because none had finished by the
      // time the others checked. Seeding is now an explicit, one-time admin
      // action — POST /api/admin/seed — so this path stays a single SELECT.
      const rows: any = await sql`SELECT * FROM quiz WHERE id = ${quizId}`;
      if (!rows || rows.length === 0) return undefined;
      return { ...rows[0], status: rows[0].status || 'locked' };
    }

    const db = getLocalSqlite();
    if (db) {
      const row = db.prepare('SELECT * FROM quiz WHERE id = ?').get(quizId) as any;
      if (!row) return undefined;
      return { ...row, status: row.status || 'locked' };
    }
    return undefined;
  },

  async upsertQuiz(quiz: Quiz, envDbUrl?: string): Promise<void> {
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      await sql`
        INSERT INTO quiz (id, title, duration_ms, grace_ms, status, opens_at, closes_at)
        VALUES (${quiz.id}, ${quiz.title}, ${quiz.duration_ms}, ${quiz.grace_ms}, ${quiz.status || 'locked'}, ${quiz.opens_at || null}, ${quiz.closes_at || null})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          duration_ms = EXCLUDED.duration_ms,
          grace_ms = EXCLUDED.grace_ms,
          status = EXCLUDED.status,
          opens_at = EXCLUDED.opens_at,
          closes_at = EXCLUDED.closes_at
      `;
      return;
    }

    const db = getLocalSqlite();
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO quiz (id, title, duration_ms, grace_ms, status, opens_at, closes_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          duration_ms = excluded.duration_ms,
          grace_ms = excluded.grace_ms,
          status = excluded.status,
          opens_at = excluded.opens_at,
          closes_at = excluded.closes_at
      `);
      stmt.run(quiz.id, quiz.title, quiz.duration_ms, quiz.grace_ms, quiz.status || 'locked', quiz.opens_at || null, quiz.closes_at || null);
      return;
    }

    throw new Error('[dbService.upsertQuiz] Database connection unavailable.');
  },

  async setQuizStatus(quizId: string, status: 'locked' | 'active' | 'finished', envDbUrl?: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      if (status === 'active') {
        await sql`UPDATE quiz SET status = ${status}, opens_at = ${nowIso} WHERE id = ${quizId}`;
      } else if (status === 'finished') {
        await sql`UPDATE quiz SET status = ${status}, closes_at = ${nowIso} WHERE id = ${quizId}`;
        await this.forceGradeAllUnsubmitted(quizId, envDbUrl);
      } else {
        await sql`UPDATE quiz SET status = ${status} WHERE id = ${quizId}`;
      }
      return;
    }

    const db = getLocalSqlite();
    if (db) {
      if (status === 'active') {
        db.prepare('UPDATE quiz SET status = ?, opens_at = ? WHERE id = ?').run(status, nowIso, quizId);
      } else if (status === 'finished') {
        db.prepare('UPDATE quiz SET status = ?, closes_at = ? WHERE id = ?').run(status, nowIso, quizId);
        await this.forceGradeAllUnsubmitted(quizId, envDbUrl);
      } else {
        db.prepare('UPDATE quiz SET status = ? WHERE id = ?').run(status, quizId);
      }
      return;
    }

    throw new Error('[dbService.setQuizStatus] Database connection unavailable.');
  },

  /**
   * There is no scheduler behind this app, so expiry is resolved lazily off the
   * polls that already run every 3s (participants + admin dashboard). Once
   * duration + grace has elapsed the quiz closes itself and everyone still
   * outstanding is graded, so the host does not have to be watching the clock.
   * Waiting for the full grace period lets in-flight auto-submissions land
   * first; those overwrite the placeholder row.
   */
  async maybeAutoFinish(quiz: Quiz, envDbUrl?: string): Promise<Quiz> {
    if (quiz.status !== 'active' || !quiz.opens_at) return quiz;

    const expiresAtMs = new Date(quiz.opens_at).getTime() + quiz.duration_ms + quiz.grace_ms;
    if (Number.isNaN(expiresAtMs) || Date.now() < expiresAtMs) return quiz;

    await this.setQuizStatus(quiz.id, 'finished', envDbUrl);
    return { ...quiz, status: 'finished', closes_at: new Date().toISOString() };
  },

  async forceGradeAllUnsubmitted(quizId: string, envDbUrl?: string): Promise<number> {
    const quiz = await this.getQuiz(quizId, envDbUrl);
    const durationMs = quiz ? quiz.duration_ms : 420000;
    const nowIso = new Date().toISOString();
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      const unsubmittedRows: any = await sql`
        SELECT p.id FROM participant p
        LEFT JOIN submission s ON p.id = s.participant_id
        WHERE p.quiz_id = ${quizId} AND s.participant_id IS NULL
      `;
      let count = 0;
      for (const row of unsubmittedRows) {
        await sql`
          INSERT INTO submission (participant_id, answers, score, correct_count, answered_count, elapsed_ms, auto_submitted, was_late, submitted_at)
          VALUES (${row.id}, '{}'::jsonb, 0, 0, 0, ${durationMs}, true, true, ${nowIso})
          ON CONFLICT (participant_id) DO NOTHING
        `;
        count++;
      }
      return count;
    }

    const db = getLocalSqlite();
    if (db) {
      const unsubmitted = db.prepare(`
        SELECT p.id FROM participant p
        LEFT JOIN submission s ON p.id = s.participant_id
        WHERE p.quiz_id = ? AND s.participant_id IS NULL
      `).all(quizId) as any[];

      const insertStmt = db.prepare(`
        INSERT INTO submission (participant_id, answers, score, correct_count, answered_count, elapsed_ms, auto_submitted, was_late, submitted_at)
        VALUES (?, '{}', 0, 0, 0, ?, 1, 1, ?)
        ON CONFLICT(participant_id) DO NOTHING
      `);

      let count = 0;
      for (const row of unsubmitted) {
        insertStmt.run(row.id, durationMs, nowIso);
        count++;
      }
      return count;
    }

    return 0;
  },

  /**
   * Clears a quiz's question set so a seed run is a true replace rather than a
   * merge. upsertQuestion keys on (quiz_id, position), so without this a seed
   * of N questions over an older set of M > N leaves positions N+1..M live and
   * still served — silently, with no error to notice.
   *
   * Safe to delete: nothing carries a foreign key to question. Submissions
   * reference question ids only as JSON keys inside `answers`.
   */
  async deleteQuestions(quizId: string, envDbUrl?: string): Promise<void> {
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      await sql`DELETE FROM question WHERE quiz_id = ${quizId}`;
      return;
    }

    const db = getLocalSqlite();
    if (db) {
      db.prepare('DELETE FROM question WHERE quiz_id = ?').run(quizId);
      return;
    }

    throw new Error('[dbService.deleteQuestions] Database connection unavailable.');
  },

  async upsertQuestion(q: Question, envDbUrl?: string): Promise<void> {
    const optsJson = typeof q.options === 'string' ? q.options : JSON.stringify(q.options);
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      await sql`
        INSERT INTO question (id, quiz_id, position, prompt, image_url, options, correct_key, points)
        VALUES (${q.id}, ${q.quiz_id}, ${q.position}, ${q.prompt}, ${q.image_url || null}, ${optsJson}::jsonb, ${q.correct_key}, ${q.points})
        ON CONFLICT (quiz_id, position) DO UPDATE SET
          id = EXCLUDED.id,
          prompt = EXCLUDED.prompt,
          image_url = EXCLUDED.image_url,
          options = EXCLUDED.options,
          correct_key = EXCLUDED.correct_key,
          points = EXCLUDED.points
      `;
      return;
    }

    const db = getLocalSqlite();
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO question (id, quiz_id, position, prompt, image_url, options, correct_key, points)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(quiz_id, position) DO UPDATE SET
          id = excluded.id,
          prompt = excluded.prompt,
          image_url = excluded.image_url,
          options = excluded.options,
          correct_key = excluded.correct_key,
          points = excluded.points
      `);
      stmt.run(q.id, q.quiz_id, q.position, q.prompt, q.image_url || null, optsJson, q.correct_key, q.points);
      return;
    }

    throw new Error('[dbService.upsertQuestion] Database connection unavailable.');
  },

  /**
   * The canonical question set — identical for every participant, and with
   * `correct_key` never selected. Because the response no longer varies by
   * participant it can be cached at the edge and served to the whole room from
   * one origin fetch. The browser applies the per-participant order.
   */
  async getPublicQuestions(quizId: string, envDbUrl?: string): Promise<QuestionPublic[]> {
    let rawQuestions: any[] = [];
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      rawQuestions = await sql`SELECT id, quiz_id as "quizId", position, prompt, image_url as "imageUrl", options, points FROM question WHERE quiz_id = ${quizId} ORDER BY position ASC`;
    } else {
      const db = getLocalSqlite();
      if (db) {
        rawQuestions = db.prepare('SELECT id, quiz_id as quizId, position, prompt, image_url as imageUrl, options, points FROM question WHERE quiz_id = ? ORDER BY position ASC').all(quizId) as any[];
      }
    }

    return rawQuestions.map((r) => ({
      id: r.id,
      quizId: r.quizId,
      position: r.position,
      prompt: r.prompt,
      imageUrl: r.imageUrl,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
      points: r.points,
    }));
  },

  async getInternalQuestions(quizId: string, envDbUrl?: string): Promise<Question[]> {
    let rows: any[] = [];
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      rows = await sql`SELECT * FROM question WHERE quiz_id = ${quizId}`;
    } else {
      const db = getLocalSqlite();
      if (db) {
        rows = db.prepare('SELECT * FROM question WHERE quiz_id = ?').all(quizId) as any[];
      }
    }
    return rows.map((r) => ({
      ...r,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
    }));
  },

  /**
   * Always mints a fresh participant. Display names are NOT identity — two
   * people may legitimately enter the same one, and each must get their own
   * row, token, question order and score. Rejoining an existing session is
   * done by presenting the session token, never by matching on name.
   */
  async createParticipant(quizId: string, displayName: string, envDbUrl?: string): Promise<Participant> {
    const id = generateUUID();
    const sessionToken = generateToken();
    const nowIso = new Date().toISOString();
    const participant: Participant = {
      id,
      quiz_id: quizId,
      display_name: displayName,
      session_token: sessionToken,
      started_at: nowIso,
      created_at: nowIso,
    };

    const sql = getNeonSql(envDbUrl);
    if (sql) {
      await sql`
        INSERT INTO participant (id, quiz_id, display_name, session_token, started_at, created_at)
        VALUES (${id}, ${quizId}, ${displayName}, ${sessionToken}, ${nowIso}, ${nowIso})
      `;
      return participant;
    }

    const db = getLocalSqlite();
    if (db) {
      db.prepare(`
        INSERT INTO participant (id, quiz_id, display_name, session_token, started_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, quizId, displayName, sessionToken, nowIso, nowIso);
      return participant;
    }

    throw new Error('Database connection unavailable.');
  },

  async getParticipantByToken(sessionToken: string, envDbUrl?: string): Promise<Participant | undefined> {
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      const rows: any = await sql`SELECT * FROM participant WHERE session_token = ${sessionToken}`;
      return rows && rows.length > 0 ? rows[0] : undefined;
    }
    const db = getLocalSqlite();
    if (db) {
      return db.prepare('SELECT * FROM participant WHERE session_token = ?').get(sessionToken) as Participant | undefined;
    }
    return undefined;
  },

  async getSubmission(participantId: string, envDbUrl?: string): Promise<Submission | undefined> {
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      const rows: any = await sql`SELECT * FROM submission WHERE participant_id = ${participantId}`;
      if (!rows || rows.length === 0) return undefined;
      const row = rows[0];
      return {
        ...row,
        answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers,
        auto_submitted: Boolean(row.auto_submitted),
        was_late: Boolean(row.was_late),
      };
    }

    const db = getLocalSqlite();
    if (db) {
      const row = db.prepare('SELECT * FROM submission WHERE participant_id = ?').get(participantId) as any;
      if (!row) return undefined;
      return {
        ...row,
        answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers,
        auto_submitted: Boolean(row.auto_submitted),
        was_late: Boolean(row.was_late),
      };
    }
    return undefined;
  },

  async createSubmission(sub: Omit<Submission, 'submitted_at'>, envDbUrl?: string): Promise<{ submission: Submission; alreadySubmitted: boolean }> {
    const existing = await this.getSubmission(sub.participant_id, envDbUrl);
    const isAutoEmpty = isPlaceholderSubmission(existing);

    if (existing && !isAutoEmpty) {
      return { submission: existing, alreadySubmitted: true };
    }

    const nowIso = new Date().toISOString();
    const answersJson = typeof sub.answers === 'string' ? sub.answers : JSON.stringify(sub.answers);

    const sql = getNeonSql(envDbUrl);
    if (sql) {
      await sql`
        INSERT INTO submission (participant_id, answers, score, correct_count, answered_count, elapsed_ms, auto_submitted, was_late, submitted_at)
        VALUES (${sub.participant_id}, ${answersJson}::jsonb, ${sub.score}, ${sub.correct_count}, ${sub.answered_count}, ${sub.elapsed_ms}, ${sub.auto_submitted}, ${sub.was_late}, ${nowIso})
        ON CONFLICT (participant_id) DO UPDATE SET
          answers = EXCLUDED.answers,
          score = EXCLUDED.score,
          correct_count = EXCLUDED.correct_count,
          answered_count = EXCLUDED.answered_count,
          elapsed_ms = EXCLUDED.elapsed_ms,
          auto_submitted = EXCLUDED.auto_submitted,
          was_late = EXCLUDED.was_late,
          submitted_at = EXCLUDED.submitted_at
      `;
      const res = await this.getSubmission(sub.participant_id, envDbUrl);
      return { submission: res!, alreadySubmitted: Boolean(existing && !isAutoEmpty) };
    }

    const db = getLocalSqlite();
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO submission (participant_id, answers, score, correct_count, answered_count, elapsed_ms, auto_submitted, was_late, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(participant_id) DO UPDATE SET
          answers = excluded.answers,
          score = excluded.score,
          correct_count = excluded.correct_count,
          answered_count = excluded.answered_count,
          elapsed_ms = excluded.elapsed_ms,
          auto_submitted = excluded.auto_submitted,
          was_late = excluded.was_late,
          submitted_at = excluded.submitted_at
      `);
      stmt.run(sub.participant_id, answersJson, sub.score, sub.correct_count, sub.answered_count, sub.elapsed_ms, sub.auto_submitted ? 1 : 0, sub.was_late ? 1 : 0, nowIso);
      const res = await this.getSubmission(sub.participant_id, envDbUrl);
      return { submission: res!, alreadySubmitted: Boolean(existing && !isAutoEmpty) };
    }

    throw new Error('Database connection unavailable.');
  },

  async getLeaderboard(quizId: string, limit = 100, envDbUrl?: string): Promise<LeaderboardEntry[]> {
    let rows: any[] = [];
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      rows = await sql`
        SELECT p.id as "participantId", p.display_name as "displayName", s.score, s.elapsed_ms as "elapsedMs", s.was_late as "wasLate", s.submitted_at as "submittedAt"
        FROM submission s
        JOIN participant p ON s.participant_id = p.id
        WHERE p.quiz_id = ${quizId}
        ORDER BY s.score DESC, s.elapsed_ms ASC, s.submitted_at ASC
        LIMIT ${limit}
      `;
    } else {
      const db = getLocalSqlite();
      if (db) {
        rows = db.prepare(`
          SELECT p.id as participantId, p.display_name as displayName, s.score, s.elapsed_ms as elapsedMs, s.was_late as wasLate, s.submitted_at as submittedAt
          FROM submission s
          JOIN participant p ON s.participant_id = p.id
          WHERE p.quiz_id = ?
          ORDER BY s.score DESC, s.elapsed_ms ASC, s.submitted_at ASC
          LIMIT ?
        `).all(quizId, limit) as any[];
      }
    }

    return rows.map((r, index) => ({
      participantId: r.participantId,
      displayName: r.displayName,
      code: participantCode(r.participantId),
      score: r.score,
      elapsedMs: r.elapsedMs,
      rank: index + 1,
      submittedAt: r.submittedAt,
      wasLate: Boolean(r.wasLate),
    }));
  },

  async getAdminStats(quizId: string, envDbUrl?: string) {
    const quiz = await this.getQuiz(quizId, envDbUrl);
    let participantCount = 0;
    let submissionCount = 0;

    const sql = getNeonSql(envDbUrl);
    if (sql) {
      const pRows: any = await sql`SELECT COUNT(*)::int as cnt FROM participant WHERE quiz_id = ${quizId}`;
      const sRows: any = await sql`SELECT COUNT(*)::int as cnt FROM submission s JOIN participant p ON s.participant_id = p.id WHERE p.quiz_id = ${quizId}`;
      participantCount = pRows[0]?.cnt || 0;
      submissionCount = sRows[0]?.cnt || 0;
    } else {
      const db = getLocalSqlite();
      if (db) {
        participantCount = (db.prepare('SELECT COUNT(*) as cnt FROM participant WHERE quiz_id = ?').get(quizId) as any).cnt;
        submissionCount = (db.prepare('SELECT COUNT(*) as cnt FROM submission s JOIN participant p ON s.participant_id = p.id WHERE p.quiz_id = ?').get(quizId) as any).cnt;
      }
    }

    return {
      status: quiz?.status || 'locked',
      title: quiz?.title,
      participantCount,
      submissionCount,
      opensAt: quiz?.opens_at,
      closesAt: quiz?.closes_at,
      durationMs: quiz?.duration_ms,
    };
  },

  async resetQuizData(quizId: string, envDbUrl?: string) {
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      await sql`TRUNCATE TABLE submission CASCADE`;
      await sql`TRUNCATE TABLE participant CASCADE`;
      await sql`UPDATE quiz SET status = 'locked', opens_at = NULL, closes_at = NULL WHERE id = ${quizId}`;
      return;
    }

    const db = getLocalSqlite();
    if (db) {
      db.exec('DELETE FROM submission');
      db.exec('DELETE FROM participant');
      db.prepare("UPDATE quiz SET status = 'locked', opens_at = NULL, closes_at = NULL WHERE id = ?").run(quizId);
    }
  },

  async exportSubmissionsCSV(quizId: string, envDbUrl?: string): Promise<string> {
    let rows: any[] = [];
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      rows = await sql`
        SELECT p.id, p.display_name, p.started_at, s.score, s.correct_count, s.answered_count, s.elapsed_ms, s.auto_submitted, s.was_late, s.submitted_at
        FROM submission s
        JOIN participant p ON s.participant_id = p.id
        WHERE p.quiz_id = ${quizId}
        ORDER BY s.score DESC, s.elapsed_ms ASC
      `;
    } else {
      const db = getLocalSqlite();
      if (db) {
        rows = db.prepare(`
          SELECT p.id, p.display_name, p.started_at, s.score, s.correct_count, s.answered_count, s.elapsed_ms, s.auto_submitted, s.was_late, s.submitted_at
          FROM submission s
          JOIN participant p ON s.participant_id = p.id
          WHERE p.quiz_id = ?
          ORDER BY s.score DESC, s.elapsed_ms ASC
        `).all(quizId) as any[];
      }
    }

    const header =
      'Code,Display Name,Participant ID,Joined At,Score,Correct Count,Answered Count,Elapsed (ms),Auto Submitted,Was Late,Submitted At\n';
    const csvRows = rows
      .map(
        (r) =>
          `${participantCode(r.id)},"${r.display_name.replace(/"/g, '""')}",${r.id},"${r.started_at}",${r.score},${r.correct_count},${r.answered_count},${r.elapsed_ms},${r.auto_submitted},${r.was_late},"${r.submitted_at}"`
      )
      .join('\n');

    return header + csvRows;
  },
};
