import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertTriangle, Users, Clock, RefreshCw, ShieldAlert, FileText } from 'lucide-react';
import { getFailedAttempts } from '../services/api';

const card = {
  background: '#fff', borderRadius: '16px', padding: '24px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6',
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function reasonStyle(reason = '') {
  const r = reason.toLowerCase();
  if (r.includes('otp')) return { bg: '#FEF3C7', color: '#B45309' };
  if (r.includes('permission')) return { bg: '#EDE9FE', color: '#7C3AED' };
  if (r.includes('released')) return { bg: '#DBEAFE', color: '#2563EB' };
  if (r.includes('network') || r.includes('authorisation')) return { bg: '#FEE2E2', color: '#DC2626' };
  if (r.includes('check')) return { bg: '#FFEDD5', color: '#C2410C' };
  return { bg: '#F3F4F6', color: '#6B7280' };
}

function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function StatCard({ icon, label, value, sublabel, bg, color }) {
  return (
    <motion.div
      whileHover={{ y: -5, boxShadow: '0 16px 40px rgba(0,0,0,0.12)' }}
      transition={{ duration: 0.2 }}
      style={{ ...card, padding: '20px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</p>
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px', fontWeight: 500 }}>{label}</p>
          <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '3px' }}>{sublabel}</p>
        </div>
        <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

export default function FailedAttemptsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getFailedAttempts();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load failed attempts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = data?.stats || { total: 0, last24h: 0, uniqueUsers: 0, flaggedUsers: 0 };
  const byReason = data?.byReason || [];
  const byUser = data?.byUser || [];
  const attempts = data?.attempts || [];
  const maxReason = Math.max(1, ...byReason.map(r => r.count));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Failed Download Attempts</h2>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
            Every refused download: wrong OTP, missing permission, or a request before release
          </p>
        </div>
        <motion.button
          onClick={load}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          <RefreshCw size={14} /> Refresh
        </motion.button>
      </div>

      <div style={{ ...card, padding: '14px 20px', marginBottom: '20px', background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <ShieldAlert size={20} style={{ color: '#DC2626', flexShrink: 0 }} />
        <p style={{ fontSize: '13px', color: '#991B1B', fontWeight: 500 }}>
          Automatic rule: 3 failed attempts within 15 minutes raises a security anomaly and alerts the Super Administrator.
        </p>
      </div>

      {error && (
        <div style={{ ...card, padding: '14px 20px', marginBottom: '20px', border: '1px solid #FECACA', color: '#991B1B', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon={<Lock size={20} />} label="Total Failed Attempts" value={stats.total} sublabel="All time" bg="#FEE2E2" color="#DC2626" />
        <StatCard icon={<Clock size={20} />} label="Last 24 Hours" value={stats.last24h} sublabel="Recent activity" bg="#FEF3C7" color="#D97706" />
        <StatCard icon={<Users size={20} />} label="Users Involved" value={stats.uniqueUsers} sublabel="Distinct accounts" bg="#DBEAFE" color="#2563EB" />
        <StatCard icon={<AlertTriangle size={20} />} label="Flagged Users" value={stats.flaggedUsers} sublabel="3+ failures in 24 hours" bg="#FEE2E2" color="#DC2626" />
      </div>

      {loading && !data ? (
        <div style={{ ...card, textAlign: 'center', padding: '48px', color: '#9CA3AF', fontSize: '13px' }}>Loading...</div>
      ) : attempts.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '60px' }}>
          <Lock size={48} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No failed attempts recorded</p>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Refused downloads will appear here</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div style={card}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>By Reason</p>
              {byReason.map((r, i) => {
                const s = reasonStyle(r.reason);
                return (
                  <div key={r.reason} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{r.reason}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: s.color }}>{r.count}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '4px', background: '#F3F4F6', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(r.count / maxReason) * 100}%` }}
                        transition={{ duration: 0.7, delay: i * 0.08 }}
                        style={{ height: '100%', borderRadius: '4px', background: s.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={card}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Users With Most Failures</p>
              {byUser.slice(0, 6).map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F9FAFB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, background: u.flagged ? 'linear-gradient(135deg, #F87171, #DC2626)' : 'linear-gradient(135deg, #60A5FA, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                      {initials(u.name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{u.name}</p>
                      <p style={{ fontSize: '10px', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {u.flagged && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: '#FEE2E2', color: '#DC2626' }}>Flagged</span>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{u.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.6fr 1.5fr 0.8fr', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', padding: '12px 20px' }}>
              {['Time', 'Invigilator', 'Paper', 'Reason', 'IP'].map(h => (
                <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
              {attempts.map((a, i) => {
                const s = reasonStyle(a.reason);
                const base = i % 2 === 0 ? '#fff' : '#FAFBFC';
                return (
                  <div
                    key={a.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.6fr 1.5fr 0.8fr', padding: '12px 20px', background: base, borderBottom: '1px solid #F8FAFC', alignItems: 'center', transition: 'background 150ms ease' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = base; }}
                  >
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{timeAgo(a.time)}</p>
                      <p style={{ fontSize: '10px', color: '#9CA3AF' }}>{new Date(a.time).toLocaleString()}</p>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{a.user?.name || 'Unknown'}</p>
                      <p style={{ fontSize: '10px', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.user?.email || ''}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <FileText size={12} style={{ color: '#6B7280', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.paperTitle}</span>
                    </div>
                    <div>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color }}>{a.reason}</span>
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6B7280' }}>{a.ip || '-'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}