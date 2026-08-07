import React, { useState } from 'react';
import { ImageOff, RefreshCw } from 'lucide-react';

export interface QuestionPublic {
  id: string;
  quizId: string;
  position: number;
  prompt: string;
  imageUrl?: string | null;
  options: Array<{ key: string; label: string }>;
  points: number;
}

interface QuestionCardProps {
  question: QuestionPublic;
  totalQuestions: number;
  selectedOptionKey?: string;
  onSelectOption: (optionKey: string) => void;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  onSubmitClick: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  totalQuestions,
  selectedOptionKey,
  onSelectOption,
  onNext,
  onPrev,
  isFirst,
  isLast,
  onSubmitClick,
}) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="riddle-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Position Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          className="font-serif text-gold"
          style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}
        >
          Riddle #{question.position} of {totalQuestions}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{question.points} Point(s)</span>
      </div>

      {/* Prompt */}
      <h2
        style={{
          fontSize: '1.25rem',
          lineHeight: '1.5',
          fontWeight: 600,
          color: '#ffffff',
          minHeight: '3.5rem',
        }}
      >
        {question.prompt}
      </h2>

      {/* Consistent Media Slot (Reserved height for layout stability across mixed text/image questions) */}
      <div className="media-container">
        {question.imageUrl ? (
          imgError ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
              <ImageOff size={32} style={{ marginBottom: '0.5rem', opacity: 0.7 }} />
              <p style={{ fontSize: '0.85rem' }}>Couldn't load riddle image.</p>
              <button
                className="btn-secondary"
                style={{ marginTop: '0.5rem', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => {
                  setImgError(false);
                  setImgLoaded(false);
                }}
              >
                <RefreshCw size={12} /> Retry Image
              </button>
            </div>
          ) : (
            <img
              src={question.imageUrl}
              alt={`Illustration for Riddle #${question.position}`}
              className="media-image"
              style={{ opacity: imgLoaded ? 1 : 0 }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              loading="eager"
            />
          )
        ) : (
          /* Text-only layout anchor placeholder to maintain option position stability */
          <div style={{ opacity: 0.15, textAlign: 'center' }}>
            <span className="font-serif text-gold" style={{ fontSize: '1rem', letterSpacing: '2px' }}>
              ✦ ARLECCHINO SANCTUM ✦
            </span>
          </div>
        )}
      </div>

      {/* Options Fieldset */}
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="sr-only" style={{ display: 'none' }}>
          Select an answer for Riddle #{question.position}
        </legend>
        <div className="options-grid">
          {question.options.map((opt) => {
            const isSelected = selectedOptionKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                className={`option-button ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectOption(opt.key)}
                aria-pressed={isSelected}
              >
                <span className="option-key-badge">{opt.key}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Bottom Navigation Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-muted)',
        }}
      >
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="btn-secondary"
          style={{ opacity: isFirst ? 0.4 : 1, cursor: isFirst ? 'not-allowed' : 'pointer' }}
        >
          ← Previous
        </button>

        {isLast ? (
          <button onClick={onSubmitClick} className="btn-gold">
            Submit Quiz 🗝️
          </button>
        ) : (
          <button onClick={onNext} className="btn-gold">
            Next Riddle →
          </button>
        )}
      </div>
    </div>
  );
};
