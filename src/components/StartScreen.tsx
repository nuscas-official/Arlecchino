import React, { useState } from 'react';
import { KeyRound, ArrowRight } from 'lucide-react';
import { isProfane } from '../utils/profanityFilter';

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
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) return;

    if (isProfane(trimmed)) {
      setNameError('That name isn\'t allowed. Please pick something else.');
      return;
    }

    setNameError(null);
    onStartQuiz(trimmed);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="riddle-card card-featured" style={{ maxWidth: '500px', width: '100%' }}>
        {/* Header panel with moon cover background */}
        <div className="cut-panel" style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <h1 className="font-serif" style={{ fontSize: 'clamp(1.4rem, 7vw, 2.4rem)', letterSpacing: '0.04em', textShadow: '0 2px 8px rgba(0,0,0,0.6)', wordBreak: 'break-word' }}>
            ARLECCHINO
          </h1>
          <p className="eyebrow" style={{ color: 'var(--gold-pale)', marginTop: '0.5rem', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
            The King of Riddles
          </p>
        </div>

        <span className="chip-crimson">NUSCAS EXCO Presents</span>

        <p style={{ fontSize: '1rem', color: 'var(--ink-mid)', lineHeight: '1.65', margin: '1rem 0 1.75rem' }}>
          Welcome, weary traveler. Answer as many of the 50 riddles related to anime, comics, and games
          we prepared to get your hands on the treasure.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="displayNameInput" className="field-label">
              Your Name
            </label>
            <div className="field-wrap">
              <KeyRound size={18} className="field-icon" />
              <input
                id="displayNameInput"
                className="text-input"
                type="text"
                required
                maxLength={40}
                placeholder="e.g. Anikun"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (nameError) setNameError(null);
                }}
              />
            </div>
          </div>

          {(nameError || error) && (
            <div className="callout callout-error" role="alert">
              <span>{nameError || error}</span>
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
          7 Minutes Limit &nbsp;·&nbsp; NUSCAS Welcome Tea
        </p>
      </div>
    </div>
  );
};
