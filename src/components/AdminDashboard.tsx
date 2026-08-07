import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Play, Lock, CheckCircle2, Download, Users, RefreshCw, KeyRound } from 'lucide-react';
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
        <div className="riddle-card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(212, 175, 55, 0.15)',
              border: '2px solid var(--border-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              boxShadow: 'var(--shadow-gold)',
            }}
          >
            <ShieldCheck size={32} className="text-gold" />
          </div>

          <h2 className="font-serif text-gold" style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>
            Host Authentication
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Enter the Admin Secret Key to access host controls, quiz unlocking, and live rankings.
          </p>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ textAlign: 'left' }}>
              <label
                htmlFor="adminSecretInput"
                style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-gold)', marginBottom: '0.4rem', fontWeight: 600 }}
              >
                Admin Secret Key:
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound
                  size={18}
                  style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
                <input
                  id="adminSecretInput"
                  type="password"
                  required
                  placeholder="Enter secret key..."
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(10, 10, 15, 0.8)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem 0.85rem 2.8rem',
                    color: '#fff',
                    fontSize: '1rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {authError && (
              <p style={{ fontSize: '0.85rem', color: 'var(--crimson-bright)', textAlign: 'left' }}>
                ⚠️ {authError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={onExitAdmin} className="btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button type="submit" className="btn-gold" disabled={loading} style={{ flex: 1.5 }}>
                {loading ? 'Verifying...' : 'Unlock Host Panel 🔑'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. Authenticated Host Control Dashboard
  return (
    <div className="riddle-card" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldCheck size={28} className="text-gold" />
            <h2 className="font-serif text-gold" style={{ fontSize: '1.6rem' }}>
              Host Control Panel
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
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
            Lock Panel 🔒
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
              background: 'rgba(20, 20, 32, 0.9)',
              border: '1px solid var(--border-gold)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginTop: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Current Quiz Status
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.3rem' }}>
                  {stats?.status === 'locked' && (
                    <span style={{ fontSize: '1.2rem', color: '#f1c40f', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Lock size={20} /> 🔒 LOCKED (Waiting for Host)
                    </span>
                  )}
                  {stats?.status === 'active' && (
                    <span style={{ fontSize: '1.2rem', color: '#2ecc71', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Play size={20} /> 🟢 ACTIVE (Riddles Unlocked & Timer Ticking)
                    </span>
                  )}
                  {stats?.status === 'finished' && (
                    <span style={{ fontSize: '1.2rem', color: 'var(--crimson-bright)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={20} /> 🏁 FINISHED (Final Results Sealed)
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
                    <Play size={18} /> Unlock & Start Quiz Now!
                  </button>
                )}
                {stats?.status === 'active' && (
                  <button
                    onClick={() => handleUpdateStatus('finished')}
                    disabled={isUpdating}
                    className="btn-secondary"
                    style={{ border: '1px solid var(--crimson-bright)', color: 'var(--crimson-bright)' }}
                  >
                    <Lock size={16} /> Force End & Grade All Answers
                  </button>
                )}
                {stats?.status === 'finished' && (
                  <button
                    onClick={() => handleUpdateStatus('active')}
                    disabled={isUpdating}
                    className="btn-secondary"
                  >
                    <RefreshCw size={16} /> Re-Open Quiz Session
                  </button>
                )}

                <button
                  onClick={handleResetDatabase}
                  disabled={isUpdating}
                  className="btn-secondary"
                  style={{ border: '1px solid #e74c3c', color: '#e74c3c' }}
                  title="Wipe all test submissions and participants"
                >
                  🧹 Clear Submissions & Reset DB
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginTop: '1.5rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid var(--border-muted)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered Participants</span>
                <h3 className="text-gold" style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>
                  <Users size={20} style={{ display: 'inline', marginRight: '0.4rem' }} />
                  {stats?.participantCount || 0}
                </h3>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed Submissions</span>
                <h3 style={{ fontSize: '1.5rem', color: '#2ecc71', marginTop: '0.2rem' }}>
                  {stats?.submissionCount || 0} / {stats?.participantCount || 0}
                </h3>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duration Limit</span>
                <h3 style={{ fontSize: '1.5rem', color: '#fff', marginTop: '0.2rem' }}>
                  {Math.floor((stats?.durationMs || 600000) / 60000)} Minutes
                </h3>
              </div>
            </div>
          </div>

          {/* Real-time Top Participants & Export */}
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="font-serif text-gold" style={{ fontSize: '1.2rem' }}>
                Live Leaderboard (Top Participants)
              </h3>
              <a
                href={`${API_BASE_URL}/api/admin/export/${quizId}?secret=${adminSecret}`}
                download
                className="btn-gold"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                <Download size={14} /> Export CSV Report
              </a>
            </div>

            {topParticipants.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
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
                    <tr key={entry.displayName + entry.rank}>
                      <td>#{entry.rank}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{entry.displayName}</td>
                      <td style={{ color: 'var(--text-gold)', fontWeight: 700 }}>{entry.score} pts</td>
                      <td style={{ fontFamily: 'monospace' }}>{Math.floor(entry.elapsedMs / 1000)}s</td>
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
