import React, { useState, useEffect } from 'react';
import { Trophy, Search, RefreshCw, Download } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  /** Short public tag; the only thing separating two identical display names. */
  code: string;
  score: number;
  elapsedMs: number;
  rank: number;
  submittedAt: string;
  wasLate?: boolean;
}

interface LeaderboardProps {
  quizId: string;
  userParticipantId?: string;
  onRetakeOrHome?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  quizId,
  userParticipantId,
  onRetakeOrHome,
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLeaderboard = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaderboard/${quizId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000); // 5s refresh rate
    return () => clearInterval(interval);
  }, [quizId]);

  const term = search.trim().toLowerCase();
  const filtered = leaderboard.filter(
    (entry) =>
      entry.displayName.toLowerCase().includes(term) ||
      (entry.code || '').toLowerCase().includes(term)
  );

  // Only surface the disambiguating code where a name is actually shared, so
  // the common case stays clean.
  const duplicateNames = new Set(
    leaderboard
      .map((e) => e.displayName.trim().toLowerCase())
      .filter((name, idx, all) => all.indexOf(name) !== idx)
  );

  const formatElapsed = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${m}m ${String(s).padStart(2, '0')}s.${String(millis).padStart(2, '0')}`;
  };

  return (
    <div className="riddle-card card-featured" style={{ maxWidth: '880px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="eyebrow eyebrow-crimson">Final Standings</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.2rem 0' }}>
            <Trophy size={26} style={{ color: 'var(--gold-rich)' }} />
            <h2 className="font-serif" style={{ fontSize: '2rem' }}>
              Hall of Riddles
            </h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
            Ranked by score (descending), then elapsed time (ascending).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={fetchLeaderboard}
            className="btn-secondary"
            disabled={isRefreshing}
            style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} /> Refresh
          </button>
          <a
            href={`${API_BASE_URL}/api/admin/export/${quizId}?secret=arlecchino-secret-key`}
            download
            className="btn-secondary"
            style={{ textDecoration: 'none', padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
          >
            <Download size={14} /> Export CSV
          </a>
        </div>
      </div>

      {/* Search Input */}
      <div className="field-wrap" style={{ marginTop: '1.25rem' }}>
        <Search size={18} className="field-icon" />
        <input
          className="text-input"
          type="text"
          placeholder="Search participant name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--ink-muted)' }}>
          Loading leaderboard standings…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--ink-muted)' }}>
          No participant submissions found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Participant</th>
                <th>Score</th>
                <th>Elapsed Time</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                // Matched on participant id: name matching used to highlight
                // every person who happened to share your name.
                const isCurrentUser = Boolean(userParticipantId) && entry.participantId === userParticipantId;
                const showCode =
                  isCurrentUser || duplicateNames.has(entry.displayName.trim().toLowerCase());

                let rankBadge = `${entry.rank}`.padStart(2, '0');
                let rankClass = '';
                if (entry.rank === 1) {
                  rankBadge = '01 · 1ST';
                  rankClass = 'rank-1';
                } else if (entry.rank === 2) {
                  rankBadge = '02 · 2ND';
                  rankClass = 'rank-2';
                } else if (entry.rank === 3) {
                  rankBadge = '03 · 3RD';
                  rankClass = 'rank-3';
                }

                return (
                  <tr key={entry.participantId} className={isCurrentUser ? 'is-you' : ''}>
                    <td>
                      <span className={`rank-badge ${rankClass}`}>{rankBadge}</span>
                    </td>
                    <td style={{ color: isCurrentUser ? 'var(--crimson)' : undefined }}>
                      {entry.displayName}
                      {showCode && entry.code && (
                        <span className="mono-num" style={{ marginLeft: '0.4rem', color: 'var(--ink-muted)' }}>
                          #{entry.code}
                        </span>
                      )}
                      {isCurrentUser && ' (You)'}
                    </td>
                    <td style={{ fontWeight: 700 }}>{entry.score} pts</td>
                    <td className="mono-num">{formatElapsed(entry.elapsedMs)}</td>
                    <td className="mono-num" style={{ color: 'var(--ink-muted)' }}>
                      {new Date(entry.submittedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {onRetakeOrHome && (
        <>
          <hr className="rule-gold" style={{ margin: '2rem 0 1.25rem' }} />
          <div style={{ textAlign: 'center' }}>
            <button onClick={onRetakeOrHome} className="btn-gold">
              Return to Entrance
            </button>
          </div>
        </>
      )}
    </div>
  );
};
