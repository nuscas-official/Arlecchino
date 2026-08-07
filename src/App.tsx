import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { shuffleQuestionsForParticipant } from './services/questionShuffler';
import { fetchQuizStatus, pollWithJitter, QuizStatus } from './services/quizStatus';
import {
  saveAnswersToDisk,
  loadAnswersFromDisk,
  submitQuizWithRetry,
  saveSession,
  loadSession,
  clearSession,
} from './services/submissionManager';
import { ShieldCheck } from 'lucide-react';

const QUIZ_ID = 'arlecchino-riddles-1';

export function App() {
  const [view, setView] = useState<'start' | 'waiting' | 'quiz' | 'leaderboard' | 'admin'>('start');
  const [displayName, setDisplayName] = useState('');
  const [participantCode, setParticipantCode] = useState('');
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
  const [isAutoSubmit, setIsAutoSubmit] = useState(false);

  /**
   * Submission reads its inputs through refs so that executeSubmission keeps a
   * stable identity. It used to depend on `answers` and `isSubmitting`, which
   * meant every answer click produced a new callback, which tore down and
   * rebuilt both the countdown timer and the force-end status poll.
   */
  const answersRef = useRef<Record<string, string>>({});
  const sessionRef = useRef({ token: '', participantId: '' });
  const isSubmittingRef = useRef(false);
  const hasSubmittedRef = useRef(false);

  const rememberSession = useCallback((token: string, pId: string, name: string) => {
    sessionRef.current = { token, participantId: pId };
    setSessionToken(token);
    setParticipantId(pId);
    setDisplayName(name);
    saveSession({ quizId: QUIZ_ID, sessionToken: token, participantId: pId, displayName: name });
  }, []);

  /**
   * Fetch the canonical question set and apply this participant's order.
   *
   * The set is identical for everyone and edge-cached, so all but the first
   * request in the room is served without touching the database. `status` is
   * passed in when the caller already has it (the waiting room polls it), which
   * avoids the redundant fetch — the old flow polled the full quiz payload,
   * threw all of it away, then immediately fetched the same payload again.
   */
  const loadQuestions = useCallback(async (pId: string, status?: QuizStatus | null) => {
    const s = status ?? (await fetchQuizStatus(QUIZ_ID));

    if (!s || s.quizStatus === 'missing') {
      throw new Error('Quiz is not available. The host may not have seeded it yet.');
    }

    if (s.quizStatus === 'locked') {
      setView('waiting');
      return false;
    }

    const qRes = await fetch(
      `${API_BASE_URL}/api/quiz/${QUIZ_ID}/questions?v=${encodeURIComponent(s.questionsVersion || '0')}`
    );
    if (!qRes.ok) {
      throw new Error('Failed to fetch quiz questions.');
    }

    const qData = await qRes.json();
    const canonical: QuestionPublic[] = qData.questions || [];
    const qList = shuffleQuestionsForParticipant(canonical, pId);

    setQuestions(qList);
    if (s.durationMs) setDurationMs(s.durationMs);
    setDeadlineIso(s.deadlineIso || new Date(Date.now() + (s.durationMs || 420000)).toISOString());

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
   * Open or reclaim a participant session. Passing an existing sessionToken
   * reclaims that exact participant; without one the server always mints a new
   * participant, so two people entering the same name stay separate.
   */
  const openSession = useCallback(
    async (name: string, existingToken?: string) => {
      const res = await fetch(`${API_BASE_URL}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: QUIZ_ID, displayName: name, sessionToken: existingToken }),
      });

      if (!res.ok) {
        throw new Error('Failed to start session. Please try again.');
      }

      const data = await res.json();
      rememberSession(data.sessionToken, data.participantId, data.displayName || name);
      setParticipantCode(data.participantCode || '');
      setDurationMs(data.durationMs);

      const savedAnswers = loadAnswersFromDisk(data.participantId);
      answersRef.current = savedAnswers;
      setAnswers(savedAnswers);

      if (data.alreadySubmitted) {
        hasSubmittedRef.current = true;
        setView('leaderboard');
        return;
      }

      await loadQuestions(data.participantId);
    },
    [loadQuestions, rememberSession]
  );

  const handleStartSession = async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await openSession(name);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reclaim an in-flight session after a refresh or a crashed tab. The clock is
  // still running server-side, so dropping the participant back at the name
  // screen would cost them the remaining time and duplicate their row.
  useEffect(() => {
    const stored = loadSession(QUIZ_ID);
    if (!stored) return;

    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) {
          await openSession(stored.displayName, stored.sessionToken);
        }
      } catch (err) {
        console.warn('Could not resume previous session:', err);
        clearSession(QUIZ_ID);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openSession]);

  const handleSelectOption = (optionKey: string) => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !participantId) return;

    const newAnswers = { ...answers, [currentQ.id]: optionKey };
    answersRef.current = newAnswers;
    setAnswers(newAnswers);
    saveAnswersToDisk(participantId, newAnswers);
    prefetchUpcomingQuestions(questions, currentIndex, 4);
  };

  const executeSubmission = useCallback(async (autoSubmitted = false) => {
    const { token, participantId: pId } = sessionRef.current;
    if (!token || !pId || isSubmittingRef.current || hasSubmittedRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setIsAutoSubmit(autoSubmitted);
    // Auto-submission used to run completely invisibly: the modal only opened
    // on a manual submit, so when the timer expired the participant just sat on
    // the question screen with no indication anything had happened — and saw
    // nothing at all if the submission then failed.
    setShowSubmitModal(true);

    if (autoSubmitted) {
      // Spread the thundering herd of simultaneous deadline submissions.
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 1500)));
    }

    try {
      await submitQuizWithRetry(token, pId, answersRef.current, autoSubmitted, (statusMsg) =>
        setSubmitError(statusMsg)
      );

      // The session is deliberately kept: a refresh after submitting should
      // land back on the leaderboard with your own row highlighted, not on the
      // name screen where you could register a second time.
      hasSubmittedRef.current = true;
      setShowSubmitModal(false);
      setView('leaderboard');
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Your answers are saved locally.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  const handleDeadlineReached = useCallback(() => {
    executeSubmission(true);
  }, [executeSubmission]);

  // Poll for a host force-end while the quiz is being taken. executeSubmission
  // is stable now, so this poll survives instead of being rebuilt on every
  // answer click (which could drop the force-end signal entirely).
  //
  // The deadline auto-submit does NOT depend on this — CountdownClock fires it
  // locally off deadlineIso, with no network involved. This exists solely for
  // the host ending the quiz early, which the client cannot predict.
  useEffect(() => {
    if (view !== 'quiz' || !sessionToken) return;

    const checkQuizStatusOnServer = async () => {
      const status = await fetchQuizStatus(QUIZ_ID);
      if (status?.quizStatus === 'finished') {
        console.log('[Quiz] Session has ended. Auto-submitting answers.');
        executeSubmission(true);
      }
    };

    return pollWithJitter(checkQuizStatusOnServer);
  }, [view, sessionToken, executeSubmission]);

  const handleReturnToEntrance = () => {
    clearSession(QUIZ_ID);
    sessionRef.current = { token: '', participantId: '' };
    answersRef.current = {};
    hasSubmittedRef.current = false;
    setView('start');
    setAnswers({});
    setDisplayName('');
    setParticipantCode('');
    setSessionToken('');
    setParticipantId('');
    setQuestions([]);
    setCurrentIndex(0);
  };

  const currentQuestion = questions[currentIndex];

  return (
    <div className="app-container">
      {/* Top Bar for Admin Switch */}
      {view === 'start' && (
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
          onQuizUnlocked={(status) => loadQuestions(participantId, status)}
        />
      )}

      {view === 'quiz' && currentQuestion && (
        <>
          <RiddleHeader
            displayName={displayName}
            participantCode={participantCode}
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
          userParticipantId={participantId}
          onRetakeOrHome={handleReturnToEntrance}
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
          isAutoSubmit={isAutoSubmit}
          onConfirmSubmit={() => executeSubmission(false)}
          onCancel={() => {
            setShowSubmitModal(false);
            setSubmitError(null);
          }}
          onRetrySubmit={() => executeSubmission(isAutoSubmit)}
          onViewStandings={() => {
            setShowSubmitModal(false);
            setView('leaderboard');
          }}
        />
      )}
    </div>
  );
}
