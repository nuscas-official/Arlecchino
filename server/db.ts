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
  displayName: string;
  score: number;
  elapsedMs: number;
  rank: number;
  submittedAt: string;
}

// Pseudo-random seeded generator for randomized question order
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

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

let neonTablesCreated = false;
async function ensureNeonTables(sql: any) {
  if (neonTablesCreated) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS quiz (id TEXT PRIMARY KEY, title TEXT NOT NULL, duration_ms INTEGER NOT NULL, grace_ms INTEGER NOT NULL DEFAULT 60000, status TEXT NOT NULL DEFAULT 'locked', opens_at TEXT, closes_at TEXT);`;
    try {
      await sql`ALTER TABLE quiz ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'locked';`;
    } catch (e) {}
    await sql`CREATE TABLE IF NOT EXISTS question (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL REFERENCES quiz(id), position INTEGER NOT NULL, prompt TEXT NOT NULL, image_url TEXT, options JSONB NOT NULL, correct_key TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 1, UNIQUE (quiz_id, position));`;
    await sql`CREATE TABLE IF NOT EXISTS participant (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL REFERENCES quiz(id), display_name TEXT NOT NULL, session_token TEXT NOT NULL UNIQUE, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`;
    await sql`CREATE TABLE IF NOT EXISTS submission (participant_id TEXT PRIMARY KEY REFERENCES participant(id), answers JSONB NOT NULL, score INTEGER NOT NULL, correct_count INTEGER NOT NULL, answered_count INTEGER NOT NULL, elapsed_ms INTEGER NOT NULL, auto_submitted BOOLEAN NOT NULL DEFAULT false, was_late BOOLEAN NOT NULL DEFAULT false, submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_submission_leaderboard ON submission (score DESC, elapsed_ms ASC, submitted_at ASC);`;
    neonTablesCreated = true;
  } catch (err) {
    console.error('[ensureNeonTables ERROR]', err);
  }
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
      await ensureNeonTables(sql);
      let rows: any = await sql`SELECT * FROM quiz WHERE id = ${quizId}`;
      if (!rows || rows.length === 0) {
        try {
          const { seedArlecchinoQuiz } = await import('./seed.js');
          await seedArlecchinoQuiz(envDbUrl);
          rows = await sql`SELECT * FROM quiz WHERE id = ${quizId}`;
        } catch (e) {
          console.error('[getQuiz Auto-Seed ERROR]', e);
        }
      }
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
      } else {
        db.prepare('UPDATE quiz SET status = ? WHERE id = ?').run(status, quizId);
      }
      return;
    }

    throw new Error('[dbService.setQuizStatus] Database connection unavailable.');
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

  async getPublicQuestionsShuffled(quizId: string, participantId: string, envDbUrl?: string): Promise<QuestionPublic[]> {
    let rawQuestions: any[] = [];
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      rawQuestions = await sql`SELECT id, quiz_id as "quizId", position, prompt, image_url as "imageUrl", options, points FROM question WHERE quiz_id = ${quizId}`;
    } else {
      const db = getLocalSqlite();
      if (db) {
        rawQuestions = db.prepare('SELECT id, quiz_id as quizId, position, prompt, image_url as imageUrl, options, points FROM question WHERE quiz_id = ?').all(quizId) as any[];
      }
    }

    const publicQuestions: QuestionPublic[] = rawQuestions.map((r) => ({
      id: r.id,
      quizId: r.quizId,
      position: r.position,
      prompt: r.prompt,
      imageUrl: r.imageUrl,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
      points: r.points,
    }));

    let seed = stringToSeed(participantId);
    const shuffled = [...publicQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed++) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.map((q, idx) => ({ ...q, position: idx + 1 }));
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

  async getOrCreateParticipant(quizId: string, displayName: string, envDbUrl?: string): Promise<Participant> {
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      const existing: any = await sql`
        SELECT p.* FROM participant p
        LEFT JOIN submission s ON p.id = s.participant_id
        WHERE p.quiz_id = ${quizId} AND LOWER(p.display_name) = LOWER(${displayName}) AND s.participant_id IS NULL
        LIMIT 1
      `;
      if (existing && existing.length > 0) return existing[0];

      const id = generateUUID();
      const sessionToken = generateToken();
      const nowIso = new Date().toISOString();

      await sql`
        INSERT INTO participant (id, quiz_id, display_name, session_token, started_at, created_at)
        VALUES (${id}, ${quizId}, ${displayName}, ${sessionToken}, ${nowIso}, ${nowIso})
      `;

      return { id, quiz_id: quizId, display_name: displayName, session_token: sessionToken, started_at: nowIso, created_at: nowIso };
    }

    const db = getLocalSqlite();
    if (db) {
      const existing = db.prepare(`
        SELECT p.* FROM participant p
        LEFT JOIN submission s ON p.id = s.participant_id
        WHERE p.quiz_id = ? AND LOWER(p.display_name) = LOWER(?) AND s.participant_id IS NULL
        LIMIT 1
      `).get(quizId, displayName) as Participant | undefined;
      if (existing) return existing;

      const id = generateUUID();
      const sessionToken = generateToken();
      const nowIso = new Date().toISOString();

      db.prepare(`
        INSERT INTO participant (id, quiz_id, display_name, session_token, started_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, quizId, displayName, sessionToken, nowIso, nowIso);

      return { id, quiz_id: quizId, display_name: displayName, session_token: sessionToken, started_at: nowIso, created_at: nowIso };
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
    if (existing) {
      return { submission: existing, alreadySubmitted: true };
    }

    const nowIso = new Date().toISOString();
    const answersJson = typeof sub.answers === 'string' ? sub.answers : JSON.stringify(sub.answers);

    const sql = getNeonSql(envDbUrl);
    if (sql) {
      await sql`
        INSERT INTO submission (participant_id, answers, score, correct_count, answered_count, elapsed_ms, auto_submitted, was_late, submitted_at)
        VALUES (${sub.participant_id}, ${answersJson}::jsonb, ${sub.score}, ${sub.correct_count}, ${sub.answered_count}, ${sub.elapsed_ms}, ${sub.auto_submitted}, ${sub.was_late}, ${nowIso})
        ON CONFLICT (participant_id) DO NOTHING
      `;
      const res = await this.getSubmission(sub.participant_id, envDbUrl);
      return { submission: res!, alreadySubmitted: false };
    }

    const db = getLocalSqlite();
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO submission (participant_id, answers, score, correct_count, answered_count, elapsed_ms, auto_submitted, was_late, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(participant_id) DO NOTHING
      `);
      stmt.run(sub.participant_id, answersJson, sub.score, sub.correct_count, sub.answered_count, sub.elapsed_ms, sub.auto_submitted ? 1 : 0, sub.was_late ? 1 : 0, nowIso);
      const res = await this.getSubmission(sub.participant_id, envDbUrl);
      return { submission: res!, alreadySubmitted: false };
    }

    throw new Error('Database connection unavailable.');
  },

  async getLeaderboard(quizId: string, limit = 100, envDbUrl?: string): Promise<LeaderboardEntry[]> {
    let rows: any[] = [];
    const sql = getNeonSql(envDbUrl);
    if (sql) {
      rows = await sql`
        SELECT p.display_name as "displayName", s.score, s.elapsed_ms as "elapsedMs", s.submitted_at as "submittedAt"
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
          SELECT p.display_name as displayName, s.score, s.elapsed_ms as elapsedMs, s.submitted_at as submittedAt
          FROM submission s
          JOIN participant p ON s.participant_id = p.id
          WHERE p.quiz_id = ?
          ORDER BY s.score DESC, s.elapsed_ms ASC, s.submitted_at ASC
          LIMIT ?
        `).all(quizId, limit) as any[];
      }
    }

    return rows.map((r, index) => ({
      displayName: r.displayName,
      score: r.score,
      elapsedMs: r.elapsedMs,
      rank: index + 1,
      submittedAt: r.submittedAt,
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
        SELECT p.display_name, s.score, s.correct_count, s.answered_count, s.elapsed_ms, s.auto_submitted, s.was_late, s.submitted_at
        FROM submission s
        JOIN participant p ON s.participant_id = p.id
        WHERE p.quiz_id = ${quizId}
        ORDER BY s.score DESC, s.elapsed_ms ASC
      `;
    } else {
      const db = getLocalSqlite();
      if (db) {
        rows = db.prepare(`
          SELECT p.display_name, s.score, s.correct_count, s.answered_count, s.elapsed_ms, s.auto_submitted, s.was_late, s.submitted_at
          FROM submission s
          JOIN participant p ON s.participant_id = p.id
          WHERE p.quiz_id = ?
          ORDER BY s.score DESC, s.elapsed_ms ASC
        `).all(quizId) as any[];
      }
    }

    const header = 'Display Name,Score,Correct Count,Answered Count,Elapsed (ms),Auto Submitted,Was Late,Submitted At\n';
    const csvRows = rows
      .map(
        (r) =>
          `"${r.display_name.replace(/"/g, '""')}",${r.score},${r.correct_count},${r.answered_count},${r.elapsed_ms},${r.auto_submitted},${r.was_late},"${r.submitted_at}"`
      )
      .join('\n');

    return header + csvRows;
  },
};
