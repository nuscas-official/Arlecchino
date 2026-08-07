import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

interface SubmissionModalProps {
  totalQuestions: number;
  answeredCount: number;
  isSubmitting: boolean;
  submitError?: string | null;
  onConfirmSubmit: () => void;
  onCancel: () => void;
  onRetrySubmit: () => void;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  totalQuestions,
  answeredCount,
  isSubmitting,
  submitError,
  onConfirmSubmit,
  onCancel,
  onRetrySubmit,
}) => {
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="grid-modal-overlay">
      <div className="grid-modal" style={{ maxWidth: '480px' }}>
        <p className="eyebrow eyebrow-crimson">Final Step</p>
        <h3 className="font-serif" style={{ fontSize: '1.7rem', margin: '0.15rem 0 0.5rem' }}>
          Submit Quiz
        </h3>

        {isSubmitting ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <Loader2 size={38} className="spin-icon" style={{ color: 'var(--crimson)' }} />
            <p style={{ marginTop: '1rem', fontWeight: 600 }}>Submitting your answers to Arlecchino…</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginTop: '0.3rem' }}>
              Your progress is safely locked in memory. Please hold tight.
            </p>
          </div>
        ) : submitError ? (
          <div style={{ padding: '1rem 0' }}>
            <div className="callout callout-error">
              <AlertCircle size={22} style={{ flexShrink: 0 }} />
              <div>
                <strong>Submission issue</strong>
                <p style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>{submitError}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.4rem' }}>
                  Your answers remain safely saved in your browser storage. You will not lose your work.
                </p>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={onCancel} className="btn-secondary">
                Back to Questions
              </button>
              <button onClick={onRetrySubmit} className="btn-gold">
                <RefreshCw size={16} /> Retry Submission
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.95rem', color: 'var(--ink-mid)', margin: '1rem 0' }}>
              Are you ready to seal your fate and hand your answers to the King of Riddles?
            </p>

            {unansweredCount > 0 ? (
              <div className="callout callout-warning" style={{ marginBottom: '1.25rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>
                  You have <strong>{unansweredCount} unanswered riddle(s)</strong> out of {totalQuestions}.
                  Unanswered riddles yield 0 points.
                </span>
              </div>
            ) : (
              <div className="callout callout-success" style={{ marginBottom: '1.25rem' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>All {totalQuestions} riddles answered — perfect completion.</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={onCancel} className="btn-secondary">
                Review Riddles
              </button>
              <button onClick={onConfirmSubmit} className="btn-gold">
                Submit Quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
