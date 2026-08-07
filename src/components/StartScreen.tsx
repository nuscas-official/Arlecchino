import React, { useState } from 'react';
import { Skull, KeyRound, ArrowRight } from 'lucide-react';

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
      <div className="riddle-card card-featured" style={{ maxWidth: '500px', width: '100%' }}>
        {/* Dark crest panel, echoing the club logo medallion on the NUSCAS homepage */}
        <div className="cut-panel" style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="crest" style={{ marginBottom: '1rem' }}>
            <Skull size={34} />
          </div>
          <h1 className="font-serif" style={{ fontSize: '2.4rem', letterSpacing: '0.06em' }}>
            ARLECCHINO
          </h1>
          <p className="eyebrow" style={{ color: 'var(--gold-pale)', marginTop: '0.5rem' }}>
            The King of Riddles
          </p>
        </div>

        <span className="chip-crimson">NUSCAS Presents</span>

        <p style={{ fontSize: '1rem', color: 'var(--ink-mid)', lineHeight: '1.65', margin: '1rem 0 1.75rem' }}>
          Welcome, weary traveler of Krat. Answer 50 riddles of steel, Ergo, and covenant law
          before the red telephone booth silences.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="displayNameInput" className="field-label">
              Your Stalker / Puppet Name
            </label>
            <div className="field-wrap">
              <KeyRound size={18} className="field-icon" />
              <input
                id="displayNameInput"
                className="text-input"
                type="text"
                required
                maxLength={40}
                placeholder="e.g. Pinocchio, Geppetto's Son"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="callout callout-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-gold"
            disabled={isLoading || !displayName.trim()}
            style={{ width: '100%', padding: '1rem', fontSize: '1.05rem', marginTop: '0.5rem' }}
          >
            {isLoading ? (
              <span>Preparing the Riddles…</span>
            ) : (
              <>
                Begin Trial of Riddles <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <hr className="rule-gold" style={{ margin: '1.5rem 0 1rem' }} />
        <p className="eyebrow" style={{ textAlign: 'center' }}>
          40 Minute Limit &nbsp;·&nbsp; Live Leaderboard
        </p>
      </div>
    </div>
  );
};
