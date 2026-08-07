import React, { useState, useEffect, useCallback } from 'react';
import { StartScreen } from './components/StartScreen';
import { RiddleHeader } from './components/RiddleHeader';
import { QuestionCard, QuestionPublic } from './components/QuestionCard';
import { QuestionGridModal } from './components/QuestionGridModal';
import { SubmissionModal } from './components/SubmissionModal';
import { Leaderboard } from './components/Leaderboard';
import { prefetchBatch, prefetchUpcomingQuestions } from './services/imagePrefetcher';
import {
  saveAnswersToDisk,
  loadAnswersFromDisk,
  submitQuizWithRetry,
  SubmissionResult,
} from './services/submissionManager';

const QUIZ_ID = 'arlecchino-riddles-1';

export function App() {
  const [view, setView] = useState<'start' | 'quiz' | 'leaderboard'>('start');
  const [displayName, setDisplayName] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [deadlineIso, setDeadlineIso] = useState('');
  const [durationMs, setDurationMs] = useState(2400000);

  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showGridModal, setShowGridModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);

  /**
   * 1. Start Session & Pre-warm Images
   */
  const handleStartSession = async (name: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // API call to /api/session/start
      const res = await fetch('/api/session/start', {
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
      setDeadlineIso(data.deadline);
      setDurationMs(data.durationMs);

      // Rehydrate local storage answers if recovering session
      const savedAnswers = loadAnswersFromDisk(data.participantId);
      setAnswers(savedAnswers);

      // Fetch questions with token
      const qRes = await fetch(`/api/quiz/${QUIZ_ID}`, {
        headers: { Authorization: `Bearer ${data.sessionToken}` },
      });

      if (!qRes.ok) {
        throw new Error('Failed to fetch quiz questions.');
      }

      const qData = await qRes.json();
      const qList: QuestionPublic[] = qData.questions || [];
      setQuestions(qList);

      // PREWARM CACHE: Prefetch first 5-8 images before starting clock view!
      const initialImages = qList
        .slice(0, 8)
        .map((q) => q.imageUrl)
        .filter(Boolean);
      prefetchBatch(initialImages).catch(() => {});

      setView('quiz');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 2. Select Option & Trigger Rolling Lookahead Prefetch
   */
  const handleSelectOption = (optionKey: string) => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !participantId) return;

    const newAnswers = { ...answers, [currentQ.id]: optionKey };
    setAnswers(newAnswers);

    // Save to localStorage immediately
    saveAnswersToDisk(participantId, newAnswers);

    // Rolling lookahead prefetch for upcoming 4 image-bearing questions
    prefetchUpcomingQuestions(questions, currentIndex, 4);
  };

  /**
   * 3. Submit Quiz Execution
   */
  const executeSubmission = useCallback(
    async (autoSubmitted = false) => {
      if (!sessionToken || !participantId || isSubmitting) return;

      setIsSubmitting(true);
      setSubmitError(null);

      // Add random jitter (0-15s) for auto-submitted deadline spike flattening if specified
      if (autoSubmitted) {
        const jitterMs = Math.floor(Math.random() * 15000);
        console.log(`[Auto-Submit] Applying ${jitterMs}ms random jitter to flatten backend load spike.`);
        await new Promise((r) => setTimeout(r, jitterMs));
      }

      try {
        const result = await submitQuizWithRetry(
          sessionToken,
          participantId,
          answers,
          autoSubmitted,
          (statusMsg) => setSubmitError(statusMsg)
        );

        setSubmissionResult(result);
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

  /**
   * 4. Deadline Reached Handler (Auto-submit)
   */
  const handleDeadlineReached = useCallback(() => {
    console.warn('[Deadline Expiry] Wall-clock timer reached 0! Triggering auto-submit with jitter...');
    executeSubmission(true);
  }, [executeSubmission]);

  const currentQuestion = questions[currentIndex];

  return (
    <div className="app-container">
      {view === 'start' && (
        <StartScreen onStartQuiz={handleStartSession} isLoading={isLoading} error={error} />
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
            setSubmissionResult(null);
          }}
        />
      )}

      {/* Grid Jump Modal */}
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

      {/* Submission Confirmation Modal */}
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
