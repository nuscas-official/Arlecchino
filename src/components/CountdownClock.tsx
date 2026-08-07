import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface CountdownClockProps {
  deadlineIso: string;
  durationMs: number;
  onDeadlineReached: () => void;
}

export const CountdownClock: React.FC<CountdownClockProps> = ({
  deadlineIso,
  durationMs,
  onDeadlineReached,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    return Math.max(0, new Date(deadlineIso).getTime() - Date.now());
  });

  // The fired flag must outlive the effect. It used to be a local, and the
  // effect re-subscribes whenever onDeadlineReached changes identity (which is
  // every keystroke on the answer sheet), so the guard was reset constantly and
  // the deadline handler fired over and over instead of exactly once.
  const firedForDeadline = useRef<string | null>(null);

  // Read through a ref so a new callback identity never restarts the timer.
  const onDeadlineReachedRef = useRef(onDeadlineReached);
  useEffect(() => {
    onDeadlineReachedRef.current = onDeadlineReached;
  }, [onDeadlineReached]);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const target = new Date(deadlineIso).getTime();
      const diff = Math.max(0, target - now);
      setRemainingMs(diff);

      // Also covers a deadline that was already in the past when we mounted —
      // e.g. a tab restored after the quiz window closed.
      if (diff <= 0 && firedForDeadline.current !== deadlineIso) {
        firedForDeadline.current = deadlineIso;
        onDeadlineReachedRef.current();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);

    // Recompute wall-clock time on tab visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [deadlineIso]);

  // Format mm:ss or hh:mm:ss
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isWarning5m = remainingMs <= 5 * 60 * 1000 && remainingMs > 1 * 60 * 1000;
  const isWarning1m = remainingMs <= 1 * 60 * 1000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
      <div
        className={`timer-badge ${isWarning1m ? 'warning-1m' : isWarning5m ? 'warning-5m' : ''}`}
        aria-label={`Time remaining: ${formattedTime}`}
      >
        {isWarning1m ? <AlertTriangle size={18} /> : <Clock size={18} />}
        <span>{formattedTime}</span>
      </div>

      {isWarning5m && (
        <span className="eyebrow" style={{ color: 'var(--gold-light)' }}>
          5 minutes remaining
        </span>
      )}
      {isWarning1m && (
        <span className="eyebrow" style={{ color: '#ff8a94' }}>
          1 minute — auto-submitting soon
        </span>
      )}
    </div>
  );
};
