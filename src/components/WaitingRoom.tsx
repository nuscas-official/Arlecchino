import React, { useEffect } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface WaitingRoomProps {
  displayName: string;
  onQuizUnlocked: () => void;
  quizId: string;
  sessionToken: string;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  displayName,
  onQuizUnlocked,
  quizId,
  sessionToken,
}) => {
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkQuizStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/quiz/${quizId}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.quizStatus === 'active') {
            onQuizUnlocked();
          }
        }
      } catch (err) {
        console.error('Polling quiz status error:', err);
      }
    };

    checkQuizStatus();
    interval = setInterval(checkQuizStatus, 3000); // 3s polling until host unlocks

    return () => clearInterval(interval);
  }, [quizId, sessionToken, onQuizUnlocked]);

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
