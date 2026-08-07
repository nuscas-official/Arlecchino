import Database from 'better-sqlite3';
import crypto from 'crypto';

export interface Quiz {
  id: string;
  title: string;
  duration_ms: number;
  grace_ms: number;
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
  correct_key: string; // Internal only! Never send to client!
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

const db = new Database('arlecchino.db');
db.pragma('journal_mode = WAL');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS quiz (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    grace_ms INTEGER NOT NULL DEFAULT 60000,
    opens_at TEXT,
    closes_at TEXT
  );

  CREATE TABLE IF NOT EXISTS question (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL REFERENCES quiz(id),
    position INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    image_url TEXT,
    options TEXT NOT NULL, -- stored as JSON string in SQLite
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
    answers TEXT NOT NULL, -- JSON string
    score INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    answered_count INTEGER NOT NULL,
    elapsed_ms INTEGER NOT NULL,
    auto_submitted INTEGER NOT NULL DEFAULT 0,
    was_late INTEGER NOT NULL DEFAULT 0,
    submitted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE INDEX IF NOT EXISTS idx_submission_leaderboard ON submission (score DESC, elapsed_ms ASC, submitted_at ASC);
  CREATE INDEX IF NOT EXISTS idx_participant_display_quiz ON participant (display_name, quiz_id);
`);

export const dbService = {
  getQuiz(quizId: string): Quiz | undefined {
    return db.prepare('SELECT * FROM quiz WHERE id = ?').get(quizId) as Quiz | undefined;
  },

  upsertQuiz(quiz: Quiz) {
    const stmt = db.prepare(`
      INSERT INTO quiz (id, title, duration_ms, grace_ms, opens_at, closes_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        duration_ms = excluded.duration_ms,
        grace_ms = excluded.grace_ms,
        opens_at = excluded.opens_at,
        closes_at = excluded.closes_at
    `);
    stmt.run(quiz.id, quiz.title, quiz.duration_ms, quiz.grace_ms, quiz.opens_at || null, quiz.closes_at || null);
  },

  upsertQuestion(q: Question) {
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
    stmt.run(
      q.id,
      q.quiz_id,
      q.position,
      q.prompt,
      q.image_url || null,
      JSON.stringify(q.options),
      q.correct_key,
      q.points
    );
  },

  /**
   * CRITICAL: Explicitly select columns and exclude `correct_key` from client view.
   */
  getPublicQuestions(quizId: string): QuestionPublic[] {
    const rows = db
      .prepare('SELECT id, quiz_id as quizId, position, prompt, image_url as imageUrl, options, points FROM question WHERE quiz_id = ? ORDER BY position ASC')
      .all(quizId) as any[];

    return rows.map((r) => ({
      id: r.id,
      quizId: r.quizId,
      position: r.position,
      prompt: r.prompt,
      imageUrl: r.imageUrl,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
      points: r.points,
    }));
  },

  /**
   * Internal question lookup with correct_key for server-side grading only.
   */
  getInternalQuestions(quizId: string): Question[] {
    const rows = db.prepare('SELECT * FROM question WHERE quiz_id = ?').all(quizId) as any[];
    return rows.map((r) => ({
      ...r,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
    }));
  },

  getOrCreateParticipant(quizId: string, displayName: string): Participant {
    // Check if participant already exists without submission
    const existing = db
      .prepare(`
        SELECT p.* FROM participant p
        LEFT JOIN submission s ON p.id = s.participant_id
        WHERE p.quiz_id = ? AND LOWER(p.display_name) = LOWER(?) AND s.participant_id IS NULL
        LIMIT 1
      `)
      .get(quizId, displayName) as Participant | undefined;

    if (existing) {
      return existing;
    }

    const id = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString('base64url');
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO participant (id, quiz_id, display_name, session_token, started_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, quizId, displayName, sessionToken, nowIso, nowIso);

    return {
      id,
      quiz_id: quizId,
      display_name: displayName,
      session_token: sessionToken,
      started_at: nowIso,
      created_at: nowIso,
    };
  },

  getParticipantByToken(sessionToken: string): Participant | undefined {
    return db
      .prepare('SELECT * FROM participant WHERE session_token = ?')
      .get(sessionToken) as Participant | undefined;
  },

  getSubmission(participantId: string): Submission | undefined {
    const row = db.prepare('SELECT * FROM submission WHERE participant_id = ?').get(participantId) as any;
    if (!row) return undefined;
    return {
      ...row,
      answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers,
      auto_submitted: Boolean(row.auto_submitted),
      was_late: Boolean(row.was_late),
    };
  },

  /**
   * Primary-key idempotency single-row write for submission.
   */
  createSubmission(sub: Omit<Submission, 'submitted_at'>): { submission: Submission; alreadySubmitted: boolean } {
    const existing = this.getSubmission(sub.participant_id);
    if (existing) {
      return { submission: existing, alreadySubmitted: true };
    }

    const nowIso = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO submission (participant_id, answers, score, correct_count, answered_count, elapsed_ms, auto_submitted, was_late, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(participant_id) DO NOTHING
    `);

    stmt.run(
      sub.participant_id,
      JSON.stringify(sub.answers),
      sub.score,
      sub.correct_count,
      sub.answered_count,
      sub.elapsed_ms,
      sub.auto_submitted ? 1 : 0,
      sub.was_late ? 1 : 0,
      nowIso
    );

    const result = this.getSubmission(sub.participant_id)!;
    return { submission: result, alreadySubmitted: false };
  },

  getLeaderboard(quizId: string, limit = 100): LeaderboardEntry[] {
    const rows = db
      .prepare(`
        SELECT p.display_name as displayName, s.score, s.elapsed_ms as elapsedMs, s.submitted_at as submittedAt
        FROM submission s
        JOIN participant p ON s.participant_id = p.id
        WHERE p.quiz_id = ?
        ORDER BY s.score DESC, s.elapsed_ms ASC, s.submitted_at ASC
        LIMIT ?
      `)
      .all(quizId, limit) as any[];

    return rows.map((r, index) => ({
      displayName: r.displayName,
      score: r.score,
      elapsedMs: r.elapsedMs,
      rank: index + 1,
      submittedAt: r.submittedAt,
    }));
  },

  exportSubmissionsCSV(quizId: string): string {
    const rows = db
      .prepare(`
        SELECT p.display_name, s.score, s.correct_count, s.answered_count, s.elapsed_ms, s.auto_submitted, s.was_late, s.submitted_at
        FROM submission s
        JOIN participant p ON s.participant_id = p.id
        WHERE p.quiz_id = ?
        ORDER BY s.score DESC, s.elapsed_ms ASC
      `)
      .all(quizId) as any[];

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
