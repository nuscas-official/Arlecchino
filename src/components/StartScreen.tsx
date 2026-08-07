import React, { useState } from 'react';
import { Skull, KeyRound, Sparkles } from 'lucide-react';

interface StartScreenProps {
  onStartQuiz: (displayName: string) => void;
  isLoading: boolean;
  error?: string | null;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStartQuiz,
  isLoading,
  error,
}) => {
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim()) {
      onStartQuiz(displayName.trim());
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="riddle-card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(168, 40, 40, 0.4) 0%, rgba(212, 175, 55, 0.3) 100%)',
            border: '2px solid var(--border-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
            boxShadow: 'var(--shadow-gold)',
          }}
        >
          <Skull size={36} className="text-gold" />
        </div>

        <h1 className="font-serif text-gold" style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>
          ARLECCHINO
        </h1>
        <h2 style={{ fontSize: '0.9rem', color: 'var(--crimson-bright)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem' }}>
          The King of Riddles
        </h2>

        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '1.75rem' }}>
          Welcome, weary traveler of Krat. Answer 50 riddles of steel, Ergo, and covenant law before the red telephone booth silences.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ textAlign: 'left' }}>
            <label
              htmlFor="displayNameInput"
              style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-gold)', marginBottom: '0.4rem', fontWeight: 600 }}
            >
              Enter Your Stalker / Puppet Name:
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound
                size={18}
                style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                id="displayNameInput"
                type="text"
                required
                maxLength={40}
                placeholder="e.g. Pinocchio, Geppetto's Son"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(10, 10, 15, 0.8)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem 0.85rem 2.8rem',
                  color: '#fff',
                  fontSize: '1rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {error && (
            <p style={{ fontSize: '0.85rem', color: 'var(--crimson-bright)', textAlign: 'left' }}>
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-gold"
            disabled={isLoading || !displayName.trim()}
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '0.5rem' }}
          >
            {isLoading ? (
              <span>Preparing the Riddles...</span>
            ) : (
              <>
                <Sparkles size={18} /> Begin Trial of Riddles
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          ⏱️ 40 Minutes Hard Time Limit | ⚡ 200 Concurrent Leaderboard
        </div>
      </div>
    </div>
  );
};
