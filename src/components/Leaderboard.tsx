import React, { useState, useEffect } from 'react';
import { Trophy, Search, RefreshCw, Download } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface LeaderboardEntry {
  displayName: string;
  score: number;
  elapsedMs: number;
  rank: number;
  submittedAt: string;
}

interface LeaderboardProps {
  quizId: string;
  userDisplayName?: string;
  onRetakeOrHome?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  quizId,
  userDisplayName,
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

  const filtered = leaderboard.filter((entry) =>
    entry.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const formatElapsed = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${m}m ${String(s).padStart(2, '0')}s.${String(millis).padStart(2, '0')}`;
  };

  return (
    <div className="riddle-card" style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Trophy size={28} className="text-gold" />
            <h2 className="font-serif text-gold" style={{ fontSize: '1.6rem' }}>
              Hall of Riddles — Leaderboard
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
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
      <div style={{ marginTop: '1.25rem', position: 'relative' }}>
        <Search
          size={18}
          style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          placeholder="Search participant name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(10, 10, 15, 0.7)',
            border: '1px solid var(--border-muted)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem 0.75rem 2.8rem',
            color: '#fff',
            fontSize: '0.95rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          Loading leaderboard standings...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
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
                const isCurrentUser =
                  userDisplayName && entry.displayName.toLowerCase() === userDisplayName.toLowerCase();

                let rankBadge = `#${entry.rank}`;
                let rankClass = '';
                if (entry.rank === 1) {
                  rankBadge = '🥇 1st';
                  rankClass = 'rank-1';
                } else if (entry.rank === 2) {
                  rankBadge = '🥈 2nd';
                  rankClass = 'rank-2';
                } else if (entry.rank === 3) {
                  rankBadge = '🥉 3rd';
                  rankClass = 'rank-3';
                }

                return (
                  <tr
                    key={entry.displayName + entry.rank}
                    style={{
                      background: isCurrentUser ? 'rgba(212, 175, 55, 0.15)' : undefined,
                      fontWeight: isCurrentUser ? 700 : undefined,
                    }}
                  >
                    <td>
                      <span className={`rank-badge ${rankClass}`}>{rankBadge}</span>
                    </td>
                    <td style={{ color: isCurrentUser ? 'var(--text-gold)' : '#fff' }}>
                      {entry.displayName} {isCurrentUser && ' (You)'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-gold)' }}>{entry.score} pts</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatElapsed(entry.elapsedMs)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
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
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button onClick={onRetakeOrHome} className="btn-gold">
            Return to Entrance 🏰
          </button>
        </div>
      )}

      <style>{`
        .spin-icon { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};
