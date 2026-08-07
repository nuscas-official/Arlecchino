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
        <h3 className="font-serif text-gold" style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>
          Submit Quiz
        </h3>

        {isSubmitting ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <Loader2 size={40} className="text-gold" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '1rem', fontWeight: 600 }}>Submitting your answers to Arlecchino...</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Your progress is safely locked in memory. Please hold tight.
            </p>
          </div>
        ) : submitError ? (
          <div style={{ padding: '1rem 0' }}>
            <div
              style={{
                background: 'rgba(230, 57, 70, 0.15)',
                border: '1px solid var(--crimson-bright)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={24} className="text-crimson" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#fff' }}>Submission issue</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {submitError}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
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
            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', margin: '1rem 0' }}>
              Are you ready to seal your fate and hand your answers to the King of Riddles?
            </p>

            {unansweredCount > 0 ? (
              <div
                style={{
                  background: 'rgba(241, 196, 15, 0.1)',
                  border: '1px solid rgba(241, 196, 15, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                  color: '#f1c40f',
                }}
              >
                ⚠️ You have <strong>{unansweredCount} unanswered riddle(s)</strong> remaining out of {totalQuestions}. Unanswered riddles will yield 0 points.
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(46, 204, 113, 0.1)',
                  border: '1px solid rgba(46, 204, 113, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                  color: '#2ecc71',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <CheckCircle2 size={18} />
                <span>All {totalQuestions} riddles answered! Perfect completion.</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={onCancel} className="btn-secondary">
                Review Riddles
              </button>
              <button onClick={onConfirmSubmit} className="btn-gold">
                Submit Quiz 🗝️
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
