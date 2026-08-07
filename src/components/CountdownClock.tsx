import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    let triggered = false;

    const updateTimer = () => {
      const now = Date.now();
      const target = new Date(deadlineIso).getTime();
      const diff = Math.max(0, target - now);
      setRemainingMs(diff);

      if (diff <= 0 && !triggered) {
        triggered = true;
        onDeadlineReached();
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
  }, [deadlineIso, onDeadlineReached]);

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
        {isWarning1m ? <AlertTriangle size={18} className="text-crimson" /> : <Clock size={18} />}
        <span>{formattedTime}</span>
      </div>

      {isWarning5m && (
        <span style={{ fontSize: '0.75rem', color: '#f1c40f', fontWeight: 600 }}>
          ⚠️ 5 minutes remaining!
        </span>
      )}
      {isWarning1m && (
        <span style={{ fontSize: '0.75rem', color: '#e63946', fontWeight: 700 }}>
          🚨 1 minute remaining — Auto-submitting soon!
        </span>
      )}
    </div>
  );
};
