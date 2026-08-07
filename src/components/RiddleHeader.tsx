import React from 'react';
import { CountdownClock } from './CountdownClock';
import { Grid } from 'lucide-react';

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
  const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <header className="site-header">
      <div>
        <p className="eyebrow">NUSCAS &nbsp;·&nbsp; King of Riddles</p>
        <h1 className="font-serif" style={{ fontSize: '1.7rem', margin: '0.15rem 0' }}>
          Arlecchino
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--gold-pale)' }}>
          Participant: <strong style={{ color: 'var(--cream)' }}>{displayName}</strong>
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '190px' }}>
          <button
            onClick={onOpenGridModal}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: '100%' }}
            title="View all questions grid"
          >
            <Grid size={16} />
            <span className="mono-num" style={{ color: 'inherit' }}>
              {answeredCount}/{totalQuestions}
            </span>
            <span>Answered</span>
          </button>
          {/* Gold meter, mirroring the "winners revealed" bar on the Awards site */}
          <div className="progress-track" style={{ marginTop: '0.45rem' }}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <CountdownClock
          deadlineIso={deadlineIso}
          durationMs={durationMs}
          onDeadlineReached={onDeadlineReached}
        />
      </div>
    </header>
  );
};
