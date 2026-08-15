import React, { useState } from 'react';
import { ImageOff, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import { RichText } from './RichText';

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
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <span className="eyebrow eyebrow-crimson">
            Riddle {String(question.position).padStart(2, '0')} / {totalQuestions}
          </span>
          <span className="eyebrow">
            {question.points} {question.points === 1 ? 'Point' : 'Points'}
          </span>
        </div>
        <hr className="rule-gold" style={{ marginTop: '0.6rem' }} />
      </div>

      {/* Prompt */}
      <h2
        className="font-serif"
        style={{
          fontSize: '1.85rem',
          lineHeight: '1.3',
          minHeight: '3.5rem',
        }}
      >
        <RichText text={question.prompt} />
      </h2>

      {/* No media slot at all for text-only questions — a reserved empty box
          here was pushing mobile layouts too tall. Height now varies between
          image and text-only questions instead of staying constant. */}
      {question.imageUrl && (
        <div className={`media-container${!imgError ? ' has-image' : ''}`}>
          {imgError ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--ink-muted)' }}>
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
          )}
        </div>
      )}

      {/* Options Fieldset */}
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="sr-only">Select an answer for Riddle #{question.position}</legend>
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
                <span><RichText text={opt.label} /></span>
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
          marginTop: '0.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-soft)',
        }}
      >
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="btn-secondary"
          style={{ opacity: isFirst ? 0.4 : 1, cursor: isFirst ? 'not-allowed' : 'pointer' }}
        >
          <ArrowLeft size={16} /> Previous
        </button>

        {isLast ? (
          <button onClick={onSubmitClick} className="btn-gold">
            Submit Quiz <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={onNext} className="btn-gold">
            Next Riddle <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
