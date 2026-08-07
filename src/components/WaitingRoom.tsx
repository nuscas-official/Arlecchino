import React, { useEffect } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { fetchQuizStatus, pollWithJitter, QuizStatus } from '../services/quizStatus';

interface WaitingRoomProps {
  displayName: string;
  onQuizUnlocked: (status: QuizStatus) => void;
  quizId: string;
}

/**
 * Unlock is the most synchronized moment of the whole event — by definition
 * everyone leaves this screen at once — so it is the one worth keeping cheap.
 *
 * This used to poll /api/quiz/:id, which meant that the instant the host
 * unlocked, all 200 waiting clients were handed the full ~30 KB question
 * payload, discarded every byte of it, and then immediately fetched the very
 * same payload again via loadQuestions. Polling the status endpoint and passing
 * the result up removes both halves of that.
 */
export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  displayName,
  onQuizUnlocked,
  quizId,
}) => {
  useEffect(() => {
    const checkQuizStatus = async () => {
      const status = await fetchQuizStatus(quizId);
      if (status?.quizStatus === 'active' || status?.quizStatus === 'finished') {
        onQuizUnlocked(status);
      }
    };

    checkQuizStatus();
    return pollWithJitter(checkQuizStatus);
  }, [quizId, onQuizUnlocked]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="riddle-card card-featured" style={{ maxWidth: '540px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
        <div className="crest" style={{ animation: 'pulse-seal 2.4s infinite' }}>
          <Lock size={34} />
        </div>

        <p className="eyebrow eyebrow-crimson">Arlecchino is preparing the riddles</p>
        <h2 className="font-serif" style={{ fontSize: '2.2rem', margin: '0.4rem 0 1.5rem' }}>
          Trial Locked
        </h2>

        <p style={{ fontSize: '1rem', color: 'var(--ink-mid)', lineHeight: '1.65', marginBottom: '1.75rem' }}>
          Welcome, <strong style={{ color: 'var(--crimson)' }}>{displayName}</strong>. Your session is
          secured. The trial is currently locked by the host.
        </p>

        <div className="callout callout-muted" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Loader2 size={18} className="spin-icon" style={{ color: 'var(--gold-deep)', flexShrink: 0 }} />
          <span>Waiting for host to unlock the trial…</span>
        </div>

        <hr className="rule-gold" style={{ margin: '1.75rem 0 1rem' }} />
        <p className="eyebrow">
          Questions appear instantly on unlock — the timer starts then
        </p>
      </div>
    </div>
  );
};
