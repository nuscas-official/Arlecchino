import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Play, Lock, CheckCircle2, Download, Users, RefreshCw, KeyRound, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface AdminDashboardProps {
  quizId: string;
  onExitAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ quizId, onExitAdmin }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [stats, setStats] = useState<any>(null);
  const [topParticipants, setTopParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [adminSecret, setAdminSecret] = useState(() => {
    return localStorage.getItem('arlecchino_admin_secret') || '';
  });

  const fetchAdminData = useCallback(async (secretToTest: string) => {
    if (!secretToTest) return false;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/stats/${quizId}`, {
        headers: { 'X-Admin-Secret': secretToTest },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setTopParticipants(data.topParticipants || []);
        setIsAuthenticated(true);
        setAuthError(null);
        localStorage.setItem('arlecchino_admin_secret', secretToTest);
        return true;
      } else {
        setIsAuthenticated(false);
        setAuthError('Invalid Admin Secret Key. Access denied.');
        return false;
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
      setAuthError('Connection error validating secret key.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (adminSecret) {
      fetchAdminData(adminSecret);
    }
  }, [adminSecret, fetchAdminData]);

  useEffect(() => {
    if (!isAuthenticated || !adminSecret) return;
    const interval = setInterval(() => {
      fetchAdminData(adminSecret);
    }, 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated, adminSecret, fetchAdminData]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (secretInput.trim()) {
      setAdminSecret(secretInput.trim());
      fetchAdminData(secretInput.trim());
    }
  };

  const handleUpdateStatus = async (newStatus: 'locked' | 'active' | 'finished') => {
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/quiz/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret,
        },
        body: JSON.stringify({ quizId, status: newStatus }),
      });
      if (res.ok) {
        await fetchAdminData(adminSecret);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetDatabase = async () => {
    if (
      !window.confirm(
        '⚠️ ARE YOU SURE? This will permanently delete ALL participant sessions and submissions, resetting the database count to 0.'
      )
    ) {
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/quiz/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret,
        },
        body: JSON.stringify({ quizId }),
      });
      if (res.ok) {
        await fetchAdminData(adminSecret);
        alert('Database cleared! Participant count and submissions are reset to 0.');
      }
    } catch (err) {
      console.error('Failed to reset database:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // 1. Authentication Gate Screen (Shown if NOT authenticated)
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '75vh' }}>
        <div className="riddle-card card-featured" style={{ maxWidth: '460px', width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="crest">
              <ShieldCheck size={30} />
            </div>
            <p className="eyebrow eyebrow-crimson">Restricted</p>
            <h2 className="font-serif" style={{ fontSize: '1.9rem', margin: '0.2rem 0 0.5rem' }}>
              Host Authentication
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-muted)', marginBottom: '1.5rem' }}>
              Enter the Admin Secret Key to access host controls, quiz unlocking, and live rankings.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="adminSecretInput" className="field-label">
                Admin Secret Key
              </label>
              <div className="field-wrap">
                <KeyRound size={18} className="field-icon" />
                <input
                  id="adminSecretInput"
                  className="text-input"
                  type="password"
                  required
                  placeholder="Enter secret key…"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                />
              </div>
            </div>

            {authError && (
              <div className="callout callout-error" role="alert">
                <span>{authError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={onExitAdmin} className="btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button type="submit" className="btn-gold" disabled={loading} style={{ flex: 1.5 }}>
                {loading ? 'Verifying…' : 'Unlock Host Panel'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. Authenticated Host Control Dashboard
  return (
    <div className="riddle-card card-featured" style={{ maxWidth: '920px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="eyebrow eyebrow-crimson">Host Only</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.2rem 0' }}>
            <ShieldCheck size={26} style={{ color: 'var(--gold-deep)' }} />
            <h2 className="font-serif" style={{ fontSize: '2rem' }}>
              Control Panel
            </h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
            Manage quiz status, unlock riddles, and monitor real-time participant progress.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              localStorage.removeItem('arlecchino_admin_secret');
            }}
            className="btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            <Lock size={14} /> Lock Panel
          </button>
          <button onClick={onExitAdmin} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            Exit Admin
          </button>
        </div>
      </div>

      {loading && !stats ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading host controls...</div>
      ) : (
        <>
          {/* Main Status & Control Card */}
          <div
            style={{
              background: 'var(--parchment)',
              border: '1px solid var(--gold)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginTop: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span className="eyebrow">Current Quiz Status</span>
                <div>
                  {stats?.status === 'locked' && (
                    <span className="status-pill status-locked">
                      <Lock size={15} /> Locked — waiting for host
                    </span>
                  )}
                  {stats?.status === 'active' && (
                    <span className="status-pill status-active">
                      <Play size={15} /> Active — timer ticking
                    </span>
                  )}
                  {stats?.status === 'finished' && (
                    <span className="status-pill status-finished">
                      <CheckCircle2 size={15} /> Finished — results sealed
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {stats?.status === 'locked' && (
                  <button
                    onClick={() => handleUpdateStatus('active')}
                    disabled={isUpdating}
                    className="btn-gold"
                    style={{ padding: '0.85rem 1.5rem', fontSize: '1.05rem' }}
                  >
                    <Play size={18} /> Unlock &amp; Start Quiz
                  </button>
                )}
                {stats?.status === 'active' && (
                  <button
                    onClick={() => handleUpdateStatus('finished')}
                    disabled={isUpdating}
                    className="btn-secondary btn-danger"
                  >
                    <Lock size={16} /> Force End &amp; Grade All
                  </button>
                )}
                {stats?.status === 'finished' && (
                  <>
                    {/* Re-runnable: grades anyone whose submission never landed. */}
                    <button
                      onClick={() => handleUpdateStatus('finished')}
                      disabled={isUpdating}
                      className="btn-secondary"
                    >
                      <CheckCircle2 size={16} /> Grade Outstanding
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('active')}
                      disabled={isUpdating}
                      className="btn-secondary"
                    >
                      <RefreshCw size={16} /> Re-Open Quiz Session
                    </button>
                  </>
                )}

                <button
                  onClick={handleResetDatabase}
                  disabled={isUpdating}
                  className="btn-secondary btn-danger"
                  title="Wipe all test submissions and participants"
                >
                  <Trash2 size={16} /> Clear &amp; Reset DB
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="stat-grid">
              <div className="stat-tile">
                <span className="eyebrow">Registered</span>
                <div className="stat-value">
                  <Users size={20} style={{ color: 'var(--gold-deep)' }} />
                  {stats?.participantCount || 0}
                </div>
              </div>
              <div className="stat-tile">
                <span className="eyebrow">Submitted</span>
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  {stats?.submissionCount || 0}
                  <span style={{ color: 'var(--ink-faint)' }}>/ {stats?.participantCount || 0}</span>
                </div>
              </div>
              <div className="stat-tile">
                <span className="eyebrow">Duration Limit</span>
                <div className="stat-value">
                  {Math.floor((stats?.durationMs || 600000) / 60000)}
                  <span style={{ fontSize: '0.9rem', color: 'var(--ink-muted)' }}>min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Top Participants & Export */}
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <p className="eyebrow eyebrow-crimson">Live</p>
                <h3 className="font-serif" style={{ fontSize: '1.5rem' }}>
                  Top Participants
                </h3>
              </div>
              <a
                href={`${API_BASE_URL}/api/admin/export/${quizId}?secret=${adminSecret}`}
                download
                className="btn-gold btn-brass"
                style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
              >
                <Download size={14} /> Export CSV
              </a>
            </div>

            {topParticipants.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
                No submissions received yet. Once participants submit, live scores will populate here.
              </p>
            ) : (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Participant</th>
                    <th>Score</th>
                    <th>Elapsed Time</th>
                  </tr>
                </thead>
                <tbody>
                  {topParticipants.map((entry) => (
                    <tr key={entry.participantId || entry.rank}>
                      <td>
                        <span className="rank-badge">{String(entry.rank).padStart(2, '0')}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {entry.displayName}
                        {/* Names are free text and repeat; the code does not. */}
                        {entry.code && (
                          <span className="mono-num" style={{ marginLeft: '0.4rem', fontWeight: 400, color: 'var(--ink-muted)' }}>
                            #{entry.code}
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>{entry.score} pts</td>
                      <td className="mono-num">{Math.floor(entry.elapsedMs / 1000)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};
