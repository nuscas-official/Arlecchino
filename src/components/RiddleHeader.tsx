import React from 'react';
import { CountdownClock } from './CountdownClock';
import { Grid, ShieldCheck } from 'lucide-react';

interface RiddleHeaderProps {
  displayName: string;
  deadlineIso: string;
  durationMs: number;
  totalQuestions: number;
  answeredCount: number;
  onOpenGridModal: () => void;
  onDeadlineReached: () => void;
}

export const RiddleHeader: React.FC<RiddleHeaderProps> = ({
  displayName,
  deadlineIso,
  durationMs,
  totalQuestions,
  answeredCount,
  onOpenGridModal,
  onDeadlineReached,
}) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 0',
        marginBottom: '1.5rem',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h1 className="font-serif text-gold" style={{ fontSize: '1.35rem', margin: 0 }}>
            Arlecchino
          </h1>
          <span style={{ fontSize: '0.8rem', opacity: 0.6, letterSpacing: '1px' }}>| KING OF RIDDLES</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          Participant: <strong style={{ color: '#fff' }}>{displayName}</strong>
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onOpenGridModal}
          className="btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          title="View all questions grid"
        >
          <Grid size={16} />
          <span>
            {answeredCount}/{totalQuestions} Answered
          </span>
        </button>

        <CountdownClock
          deadlineIso={deadlineIso}
          durationMs={durationMs}
          onDeadlineReached={onDeadlineReached}
        />
      </div>
    </header>
  );
};
