import React, { useState, useCallback, useEffect } from 'react';
import { StartScreen } from './components/StartScreen';
import { WaitingRoom } from './components/WaitingRoom';
import { RiddleHeader } from './components/RiddleHeader';
import { QuestionCard, QuestionPublic } from './components/QuestionCard';
import { QuestionGridModal } from './components/QuestionGridModal';
import { SubmissionModal } from './components/SubmissionModal';
import { Leaderboard } from './components/Leaderboard';
import { AdminDashboard } from './components/AdminDashboard';
import { API_BASE_URL } from './config';
import { prefetchBatch, prefetchUpcomingQuestions } from './services/imagePrefetcher';
import {
  saveAnswersToDisk,
  loadAnswersFromDisk,
  submitQuizWithRetry,
  SubmissionResult,
} from './services/submissionManager';
import { ShieldCheck } from 'lucide-react';

const QUIZ_ID = 'arlecchino-riddles-1';

export function App() {
  const [view, setView] = useState<'start' | 'waiting' | 'quiz' | 'leaderboard' | 'admin'>('start');
  const [displayName, setDisplayName] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [deadlineIso, setDeadlineIso] = useState('');
  const [durationMs, setDurationMs] = useState(420000);

  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showGridModal, setShowGridModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Fetch Quiz Questions (handles randomized order & status check)
   */
  const loadQuestions = useCallback(async (token: string, pId: string) => {
    const qRes = await fetch(`${API_BASE_URL}/api/quiz/${QUIZ_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!qRes.ok) {
      throw new Error('Failed to fetch quiz questions.');
    }

    const qData = await qRes.json();

    if (qData.quizStatus === 'locked') {
      setView('waiting');
      return false;
    }

    const qList: QuestionPublic[] = qData.questions || [];
    setQuestions(qList);
    setDeadlineIso(qData.quiz?.deadlineIso || new Date(Date.now() + 420000).toISOString());

    // Pre-warm initial 8 images
    const initialImages = qList
      .slice(0, 8)
      .map((q) => q.imageUrl)
      .filter(Boolean);
    prefetchBatch(initialImages).catch(() => {});

    setView('quiz');
    return true;
  }, []);

  /**
   * Start Participant Session
   */
  const handleStartSession = async (name: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: QUIZ_ID, displayName: name }),
      });

      if (!res.ok) {
        throw new Error('Failed to start session. Please try again.');
      }

      const data = await res.json();
      setDisplayName(name);
      setSessionToken(data.sessionToken);
      setParticipantId(data.participantId);
      setDurationMs(data.durationMs);

      // Rehydrate local storage draft answers
      const savedAnswers = loadAnswersFromDisk(data.participantId);
      setAnswers(savedAnswers);

      await loadQuestions(data.sessionToken, data.participantId);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (optionKey: string) => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !participantId) return;

    const newAnswers = { ...answers, [currentQ.id]: optionKey };
    setAnswers(newAnswers);
    saveAnswersToDisk(participantId, newAnswers);
    prefetchUpcomingQuestions(questions, currentIndex, 4);
  };

  const executeSubmission = useCallback(
    async (autoSubmitted = false) => {
      if (!sessionToken || !participantId || isSubmitting) return;

      setIsSubmitting(true);
      setSubmitError(null);

      if (autoSubmitted) {
        const jitterMs = Math.floor(Math.random() * 1500);
        await new Promise((r) => setTimeout(r, jitterMs));
      }

      try {
        await submitQuizWithRetry(
          sessionToken,
          participantId,
          answers,
          autoSubmitted,
          (statusMsg) => setSubmitError(statusMsg)
        );

        setShowSubmitModal(false);
        setView('leaderboard');
      } catch (err: any) {
        setSubmitError(err.message || 'Submission failed. Your answers are saved locally.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [sessionToken, participantId, answers, isSubmitting]
  );

  const handleDeadlineReached = useCallback(() => {
    executeSubmission(true);
  }, [executeSubmission]);

  // Periodic polling for quiz status while actively taking quiz (detect host force-end)
  useEffect(() => {
    if (view !== 'quiz' || !sessionToken) return;

    let interval: NodeJS.Timeout;
    const checkQuizStatusOnServer = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/quiz/${QUIZ_ID}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.quizStatus === 'finished') {
            console.log('[Quiz] Host has force-ended the quiz session. Auto-submitting answers.');
            executeSubmission(true);
          }
        }
      } catch (err) {
        console.error('Quiz status polling error:', err);
      }
    };

    interval = setInterval(checkQuizStatusOnServer, 3000);
    return () => clearInterval(interval);
  }, [view, sessionToken, executeSubmission]);

  const currentQuestion = questions[currentIndex];

  return (
    <div className="app-container">
      {/* Top Bar for Admin Switch */}
      {view !== 'admin' && view !== 'quiz' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <button onClick={() => setView('admin')} className="btn-ghost">
            <ShieldCheck size={14} /> Host Dashboard
          </button>
        </div>
      )}

      {view === 'start' && (
        <StartScreen onStartQuiz={handleStartSession} isLoading={isLoading} error={error} />
      )}

      {view === 'waiting' && (
        <WaitingRoom
          displayName={displayName}
          quizId={QUIZ_ID}
          sessionToken={sessionToken}
          onQuizUnlocked={() => loadQuestions(sessionToken, participantId)}
        />
      )}

      {view === 'quiz' && currentQuestion && (
        <>
          <RiddleHeader
            displayName={displayName}
            deadlineIso={deadlineIso}
            durationMs={durationMs}
            totalQuestions={questions.length}
            answeredCount={Object.keys(answers).length}
            onOpenGridModal={() => setShowGridModal(true)}
            onDeadlineReached={handleDeadlineReached}
          />

          <main style={{ flex: 1 }}>
            <QuestionCard
              question={currentQuestion}
              totalQuestions={questions.length}
              selectedOptionKey={answers[currentQuestion.id]}
              onSelectOption={handleSelectOption}
              onNext={() => {
                if (currentIndex < questions.length - 1) {
                  const nextIdx = currentIndex + 1;
                  setCurrentIndex(nextIdx);
                  prefetchUpcomingQuestions(questions, nextIdx, 4);
                }
              }}
              onPrev={() => {
                if (currentIndex > 0) {
                  setCurrentIndex(currentIndex - 1);
                }
              }}
              isFirst={currentIndex === 0}
              isLast={currentIndex === questions.length - 1}
              onSubmitClick={() => setShowSubmitModal(true)}
            />
          </main>
        </>
      )}

      {view === 'leaderboard' && (
        <Leaderboard
          quizId={QUIZ_ID}
          userDisplayName={displayName}
          onRetakeOrHome={() => {
            setView('start');
            setAnswers({});
            setDisplayName('');
          }}
        />
      )}

      {view === 'admin' && (
        <AdminDashboard quizId={QUIZ_ID} onExitAdmin={() => setView('start')} />
      )}

      {showGridModal && (
        <QuestionGridModal
          questions={questions}
          answers={answers}
          currentIndex={currentIndex}
          onSelectQuestion={(idx) => setCurrentIndex(idx)}
          onClose={() => setShowGridModal(false)}
          onSubmitClick={() => setShowSubmitModal(true)}
        />
      )}

      {showSubmitModal && (
        <SubmissionModal
          totalQuestions={questions.length}
          answeredCount={Object.keys(answers).length}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onConfirmSubmit={() => executeSubmission(false)}
          onCancel={() => setShowSubmitModal(false)}
          onRetrySubmit={() => executeSubmission(false)}
        />
      )}
    </div>
  );
}
