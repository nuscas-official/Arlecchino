import React, { useEffect } from 'react';
import { Lock, Loader2 } from 'lucide-react';

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
        const res = await fetch(`/api/quiz/${quizId}`, {
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
      <div className="riddle-card" style={{ maxWidth: '520px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(212, 175, 55, 0.15)',
            border: '2px solid var(--border-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            boxShadow: 'var(--shadow-gold)',
            animation: 'pulse-gold 2s infinite',
          }}
        >
          <Lock size={38} className="text-gold" />
        </div>

        <h2 className="font-serif text-gold" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Trial Locked
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--crimson-bright)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
          Arlecchino is Preparing the Riddles
        </p>

        <p style={{ fontSize: '1rem', color: '#fff', lineHeight: '1.6', marginBottom: '1.75rem' }}>
          Welcome, <strong className="text-gold">{displayName}</strong>. Your session token is secured. The trial is currently locked by the host.
        </p>

        <div
          style={{
            background: 'rgba(10, 10, 15, 0.8)',
            border: '1px solid var(--border-muted)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
          }}
        >
          <Loader2 size={20} className="text-gold" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Waiting for host to unlock the trial...</span>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.75rem' }}>
          ⚡ Once unlocked, your randomized questions will appear instantly and the timer will start.
        </p>
      </div>

      <style>{`
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.2); }
          50% { box-shadow: 0 0 30px rgba(212, 175, 55, 0.6); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
