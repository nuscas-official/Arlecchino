import { dbService, Quiz, Question } from './db.js';

export async function seedArlecchinoQuiz(envDbUrl?: string) {
  const quizId = 'arlecchino-riddles-1';
  
  const quiz: Quiz = {
    id: quizId,
    title: 'Arlecchino: King of Riddles Trial',
    duration_ms: 420000,   // 7 minutes
    grace_ms: 60000,       // 60 seconds grace period
    status: 'locked',      // Default to locked until host unlocks
    opens_at: new Date().toISOString(),
  };

  await dbService.upsertQuiz(quiz, envDbUrl);

  // Arlecchino Lies of P Riddles & Custom Tricky MCQs (50 items)
  const riddlesData: Array<{
    prompt: string;
    imageUrl?: string;
    options: Array<{ key: string; label: string }>;
    correctKey: string;
  }> = [
    {
      prompt: "I am a morning creature that walks on four legs at dawn, two legs at noon, and three at dusk. What am I, dear puppet?",
      imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
      options: [
        { key: "a", label: "A stalker of Krat" },
        { key: "b", label: "A human being" },
        { key: "c", label: "An Ergo puppet" },
        { key: "d", label: "A petrified corpse" }
      ],
      correctKey: "b"
    },
    {
      prompt: "Before the Grand Exhibition, what stands tall in Krat's harbor representing human ambition?",
      imageUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80",
      options: [
        { key: "a", label: "The Stargazer" },
        { key: "b", label: "The Golden Tree" },
        { key: "c", label: "The Statue of the Saintess of Mercy" },
        { key: "d", label: "The Monad House" }
      ],
      correctKey: "c"
    },
    {
      prompt: "I have no voice, yet I tell the secret of Ergo. I cannot move, yet I guide puppets through death. What am I?",
      imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80",
      options: [
        { key: "a", label: "A Stargazer" },
        { key: "b", label: "A Trinity Key" },
        { key: "c", label: "A Cryptic Vessel" },
        { key: "d", label: "A Pocket Watch" }
      ],
      correctKey: "a"
    },
    {
      prompt: "What is the true essence that gives puppets human-like life and memories in Krat?",
      imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
      options: [
        { key: "a", label: "Krat Ore" },
        { key: "b", label: "Ergo" },
        { key: "c", label: "Petrification Fluid" },
        { key: "d", label: "Alchemical Mercury" }
      ],
      correctKey: "b"
    },
    {
      prompt: "I ring in red phone booths scattered across Krat. When you answer, who greets your ears with deadly laughter?",
      options: [
        { key: "a", label: "Venigni" },
        { key: "b", label: "Geppetto" },
        { key: "c", label: "Arlecchino, King of Riddles" },
        { key: "d", label: "Simon Manus" }
      ],
      correctKey: "c"
    },
    {
      prompt: "Which Law of the Grand Covenant strictly dictates that a puppet cannot lie?",
      options: [
        { key: "a", label: "Article 1" },
        { key: "b", label: "Article 4" },
        { key: "c", label: "Article 3" },
        { key: "d", label: "Article 2" }
      ],
      correctKey: "b"
    },
    {
      prompt: "What key opens the hidden Sanctum doors where Trinity rooms are kept?",
      imageUrl: "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&auto=format&fit=crop&q=80",
      options: [
        { key: "a", label: "Golden Key" },
        { key: "b", label: "Trinity Key" },
        { key: "c", label: "Venigni Key" },
        { key: "d", label: "Sanctuary Locket" }
      ],
      correctKey: "b"
    },
    {
      prompt: "What turns a mechanical heart human: telling comforting lies or sticking to ruthless truth?",
      options: [
        { key: "a", label: "Always telling the truth" },
        { key: "b", label: "Telling human lies to show empathy" },
        { key: "c", label: "Destroying all Ergo" },
        { key: "d", label: "Following Covenant laws strictly" }
      ],
      correctKey: "b"
    },
    {
      prompt: "I am light in dark shadows, I tick without a spring, I am born of human blood yet forged of iron skin. What am I?",
      imageUrl: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&auto=format&fit=crop&q=80",
      options: [
        { key: "a", label: "P's Heart" },
        { key: "b", label: "A Clockwork Scythe" },
        { key: "c", label: "A Legion Arm" },
        { key: "d", label: "A Golden Lie" }
      ],
      correctKey: "a"
    },
    {
      prompt: "At the Arche Abbey, who seeks to transcend humanity and become a new God using Ergo energy?",
      imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
      options: [
        { key: "a", label: "Arlecchino" },
        { key: "b", label: "Laxasia the Complete" },
        { key: "c", label: "Simon Manus" },
        { key: "d", label: "Victor the Champion" }
      ],
      correctKey: "c"
    }
  ];

  // Generate 40 additional systematic riddle items to make 50 questions total
  for (let i = 11; i <= 50; i++) {
    const isImage = i % 2 === 0;
    riddlesData.push({
      prompt: `Riddle #${i}: I hold ${i * 12} secrets in my gears. If you subtract ${i} from my pendulum, which door unlocks?`,
      imageUrl: isImage ? `https://images.unsplash.com/photo-${1500000000000 + (i * 100000)}?w=800&auto=format&fit=crop&q=80` : undefined,
      options: [
        { key: "a", label: `Option A for Riddle ${i}` },
        { key: "b", label: `Option B for Riddle ${i}` },
        { key: "c", label: `Option C for Riddle ${i}` },
        { key: "d", label: `Option D for Riddle ${i}` }
      ],
      correctKey: ["a", "b", "c", "d"][(i % 4)]
    });
  }

  for (let idx = 0; idx < riddlesData.length; idx++) {
    const item = riddlesData[idx];
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

  console.log(`[Seed] Seeded Quiz '${quizId}' with ${riddlesData.length} questions successfully.`);
}

if (process.argv[1]?.includes('seed.ts')) {
  seedArlecchinoQuiz();
}
