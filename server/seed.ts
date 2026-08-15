import { dbService, ensureNeonTables, neonSqlFor, Quiz, Question } from './db.js';
import { riddles } from './riddles.js';

export async function seedArlecchinoQuiz(envDbUrl?: string) {
  const quizId = 'arlecchino-riddles-1';

  // The only place schema migration runs. It used to fire lazily from getQuiz
  // on every cold Worker isolate; see ensureNeonTables for why that was bad
  // under a join burst.
  const sql = neonSqlFor(envDbUrl);
  if (sql) {
    await ensureNeonTables(sql);
  }

  const quiz: Quiz = {
    id: quizId,
    title: 'Arlecchino: King of Riddles Trial',
    duration_ms: 420000,   // 7 minutes
    grace_ms: 60000,       // 60 seconds grace period
    status: 'locked',      // Default to locked until host unlocks
    opens_at: new Date().toISOString(),
  };

  await dbService.upsertQuiz(quiz, envDbUrl);

  // A seed run replaces the question set outright. Without this, upserting on
  // (quiz_id, position) would leave any trailing questions from a longer
  // previous set alive in the table.
  await dbService.deleteQuestions(quizId, envDbUrl);

  for (let idx = 0; idx < riddles.length; idx++) {
    const item = riddles[idx];
    const q: Question = {
      id: `q-${idx + 1}`,
      quiz_id: quizId,
      position: idx + 1,
      prompt: item.prompt,
      image_url: item.imageUrl,
      options: item.options,
      correct_key: item.correctKey,
      points: 1,
    };
    await dbService.upsertQuestion(q, envDbUrl);
  }

  console.log(`[Seed] Seeded Quiz '${quizId}' with ${riddles.length} questions successfully.`);
}

if (process.argv[1]?.includes('seed.ts')) {
  seedArlecchinoQuiz();
}
