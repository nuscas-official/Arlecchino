import React from 'react';
import { X } from 'lucide-react';
import { QuestionPublic } from './QuestionCard';

interface QuestionGridModalProps {
  questions: QuestionPublic[];
  answers: Record<string, string>;
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  onClose: () => void;
  onSubmitClick: () => void;
}

export const QuestionGridModal: React.FC<QuestionGridModalProps> = ({
  questions,
  answers,
  currentIndex,
  onSelectQuestion,
  onClose,
  onSubmitClick,
}) => {
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="grid-modal-overlay" onClick={onClose}>
      <div className="grid-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="eyebrow eyebrow-crimson">Navigation</p>
            <h3 className="font-serif" style={{ fontSize: '1.6rem', margin: '0.15rem 0' }}>
              Riddle Map
            </h3>
            <p className="mono-num">
              {answeredCount} / {questions.length} answered
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem' }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="progress-track" style={{ marginTop: '1rem' }}>
          <div
            className="progress-fill"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>

        <div className="q-grid">
          {questions.map((q, index) => {
            const isAnswered = Boolean(answers[q.id]);
            const isCurrent = currentIndex === index;

            return (
              <button
                key={q.id}
                onClick={() => {
                  onSelectQuestion(index);
                  onClose();
                }}
                className={`q-grid-item ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}`}
                title={`Riddle #${q.position} (${isAnswered ? 'Answered' : 'Unanswered'})`}
              >
                {q.position}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} className="btn-secondary">
            Resume Quiz
          </button>
          <button
            onClick={() => {
              onClose();
              onSubmitClick();
            }}
            className="btn-gold"
          >
            Submit Quiz
          </button>
        </div>
      </div>
    </div>
  );
};
