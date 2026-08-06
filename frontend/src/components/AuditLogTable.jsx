import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldCheck, Search, RefreshCw, Download,
  LogIn, LogOut, FileDown, Users, Upload, AlertTriangle,
  Activity, Eye, Copy, CheckCircle2, Lock, FileText,
} from 'lucide-react';

const EVENT_CONFIG = {
  USER_LOGIN:          { label: 'User Login',         bg: '#DBEAFE', color: '#2563EB', icon: <LogIn size={12} /> },
  USER_LOGOUT:         { label: 'User Logout',        bg: '#F3F4F6', color: '#6B7280', icon: <LogOut size={12} /> },
  USER_LOGIN_FAILED:   { label: 'Login Failed',       bg: '#FEE2E2', color: '#DC2626', icon: <Lock size={12} /> },
  USER_LOCKED:         { label: 'Account Locked',     bg: '#FEE2E2', color: '#DC2626', icon: <Lock size={12} /> },
  PAPER_UPLOADED:      { label: 'Paper Uploaded',     bg: '#EDE9FE', color: '#7C3AED', icon: <Upload size={12} /> },
  PAPER_DOWNLOADED:    { label: 'Paper Downloaded',   bg: '#DCFCE7', color: '#16A34A', icon: <FileDown size={12} /> },
  PAPER_RELEASED:      { label: 'Paper Released',     bg: '#DCFCE7', color: '#16A34A', icon: <CheckCircle2 size={12} /> },
  PAPER_ACCESSED:      { label: 'Paper Accessed',     bg: '#DBEAFE', color: '#2563EB', icon: <Eye size={12} /> },
  PERMISSION_GRANTED:  { label: 'Permission Granted', bg: '#F0FDF4', color: '#16A34A', icon: <Users size={12} /> },
  PERMISSION_REVOKED:  { label: 'Permission Revoked', bg: '#FEF3C7', color: '#D97706', icon: <Users size={12} /> },
  ANOMALY_DETECTED:    { label: 'Anomaly Detected',   bg: '#FEE2E2', color: '#DC2626', icon: <AlertTriangle size={12} /> },
  ADMIN_ACTION:        { label: 'Admin Action',       bg: '#FEF3C7', color: '#D97706', icon: <ShieldCheck size={12} /> },
  TOKEN_REFRESHED:     { label: 'Token Refreshed',    bg: '#F3F4F6', color: '#6B7280', icon: <Activity size={12} /> },
};

const FILTER_TABS = [
  { label: 'All',         value: 'all' },
  { label: 'Logins',      value: 'login' },
  { label: 'Downloads',   value: 'download' },
  { label: 'Uploads',     value: 'upload' },
  { label: 'Permissions', value: 'permission' },
  { label: 'Security',    value: 'security' },
  { label: 'Anomalies',   value: 'anomaly' },
];

function matchesFilter(eventType, filter) {
  if (filter === 'all') return true;
  if (filter === 'login') return eventType.includes('LOGIN') || eventType.includes('LOGOUT');
  if (filter === 'download') return eventType.includes('DOWNLOADED');
  if (filter === 'upload') return eventType.includes('UPLOADED');
  if (filter === 'permission') return eventType.includes('PERMISSION');
  if (filter === 'security') return eventType.includes('FAILED') || eventType.includes('LOCKED') || eventType.includes('ANOMALY');
  if (filter === 'anomaly') return eventType.includes('ANOMALY');
  return true;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
}

const StatCard = ({ icon, label, value, bg, color }) => (
  <motion.div
    whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.10)' }}
    transition={{ duration: 0.2 }}
    style={{
      background: '#fff', borderRadius: '14px', padding: '18px 20px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #F3F4F6',
      display: 'flex', alignItems: 'center', gap: '14px',
    }}
  >
    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <p style={{ fontSize: '22px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', fontWeight: 500 }}>{label}</p>
    </div>
  </motion.div>
);

export default function AuditLogTable({ logs = [], onVerify, onRefresh, verifyLoading, hashResult }) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

  const totalEvents = logs.length;
  const downloads = logs.filter(l => l.eventType === 'PAPER_DOWNLOADED').length;
  const securityEvents = logs.filter(l =>
    l.eventType.includes('ANOMALY') || l.eventType.includes('FAILED') || l.eventType.includes('LOCKED')
  ).length;
  const activeUsers = new Set(logs.filter(l => l.userId).map(l => l.userId)).size;

  const filtered = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        !search ||
        log.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
        log.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.eventType.toLowerCase().includes(search.toLowerCase()) ||
        log.paperId?.toLowerCase().includes(search.toLowerCase());
      return matchesSearch && matchesFilter(log.eventType, activeFilter);
    });
  }, [logs, search, activeFilter]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = () => {
    const csv = [
      ['Event Type', 'User', 'Email', 'Paper ID', 'Timestamp'].join(','),
      ...filtered.map(l => [
        l.eventType,
        l.user?.name || 'System',
        l.user?.email || '',
        l.paperId || '',
        new Date(l.createdAt).toISOString(),
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Stat Cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={<Activity size={20} />} label="Total Events"    value={totalEvents}    bg="#EFF6FF" color="#2563EB" />
        <StatCard icon={<FileDown size={20} />} label="Downloads"       value={downloads}      bg="#DCFCE7" color="#16A34A" />
        <StatCard icon={<AlertTriangle size={20} />} label="Security Events" value={securityEvents} bg="#FEE2E2" color="#DC2626" />
        <StatCard icon={<Users size={20} />}    label="Active Users"    value={activeUsers}    bg="#EDE9FE" color="#7C3AED" />
      </div>

      {/* ── Hash Chain Integrity Card ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: hashResult
            ? hashResult.valid
              ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)'
              : 'linear-gradient(135deg, #FEF2F2, #FEE2E2)'
            : 'linear-gradient(135deg, #F8FAFF, #EEF4FF)',
          border: `1px solid ${hashResult ? hashResult.valid ? '#BBF7D0' : '#FECACA' : '#BFDBFE'}`,
          borderRadius: '14px', padding: '16px 20px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: hashResult ? hashResult.valid ? '#DCFCE7' : '#FEE2E2' : '#DBEAFE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={22} style={{ color: hashResult ? hashResult.valid ? '#16A34A' : '#DC2626' : '#2563EB' }} />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Hash Chain Integrity</p>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
              {hashResult
                ? hashResult.valid
                  ? `✓ Verified — All ${totalEvents} entries intact`
                  : `✗ Tampered — ${hashResult.message}`
                : 'Click "Verify Hash Chain" to check integrity'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hashResult && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: hashResult.valid ? '#16A34A' : '#DC2626' }}>
                {hashResult.valid ? '100% Integrity' : 'COMPROMISED'}
              </p>
              <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>
                Last verified: {new Date().toLocaleTimeString()}
              </p>
            </div>
          )}
          <motion.button
            onClick={onVerify}
            disabled={verifyLoading}
            whileHover={!verifyLoading ? { y: -2, boxShadow: '0 8px 20px rgba(37,99,235,0.3)' } : {}}
            whileTap={!verifyLoading ? { scale: 0.97 } : {}}
            style={{
              background: verifyLoading ? '#93C5FD' : 'linear-gradient(90deg, #2563EB, #4F46E5)',
              color: '#fff', border: 'none', borderRadius: '10px',
              padding: '9px 18px', fontSize: '13px', fontWeight: 600,
              cursor: verifyLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 14px rgba(37,99,235,0.22)',
            }}
          >
            {verifyLoading
              ? <div style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <ShieldCheck size={14} />}
            {verifyLoading ? 'Verifying...' : 'Verify Hash Chain'}
          </motion.button>
        </div>
      </motion.div>

      {/* ── Search + Actions ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            placeholder="Search users, events, paper hashes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', height: '42px', borderRadius: '12px',
              border: '1.5px solid #E5E7EB', background: '#F9FAFB',
              color: '#111827', fontSize: '13px',
              paddingLeft: '40px', paddingRight: '16px',
              outline: 'none', transition: 'all 200ms ease', boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F9FAFB'; }}
          />
        </div>
        <motion.button
          onClick={handleExport}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '42px', borderRadius: '12px', border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          <Download size={14} /> Export CSV
        </motion.button>
        <motion.button
          onClick={onRefresh}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '42px', borderRadius: '12px', border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          <RefreshCw size={14} /> Refresh
        </motion.button>
      </div>

      {/* ── Filter Chips ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTER_TABS.map(tab => (
          <motion.button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 200ms ease',
              background: activeFilter === tab.value ? 'linear-gradient(90deg, #2563EB, #4F46E5)' : '#F3F4F6',
              color: activeFilter === tab.value ? '#fff' : '#6B7280',
              boxShadow: activeFilter === tab.value ? '0 4px 12px rgba(37,99,235,0.25)' : 'none',
            }}
          >
            {tab.label}
            {tab.value !== 'all' && (
              <span style={{ marginLeft: '5px', fontSize: '10px', opacity: 0.8 }}>
                ({logs.filter(l => matchesFilter(l.eventType, tab.value)).length})
              </span>
            )}
          </motion.button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9CA3AF' }}>
          {filtered.length} of {totalEvents} events
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '16px', border: '1px solid #F3F4F6' }}>
          <Shield size={48} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No audit events found</p>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Try adjusting your search or filter</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {/* Header Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.8fr 1.2fr 1.2fr 0.4fr', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', padding: '0 20px' }}>
            {['Event', 'User', 'Paper', 'Time', ''].map((h, i) => (
              <div key={i} style={{ padding: '12px 0', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {filtered.map((log, i) => {
              const ev = EVENT_CONFIG[log.eventType] || {
                label: log.eventType, bg: '#F3F4F6', color: '#6B7280', icon: <Activity size={12} />,
              };
              const isEven = i % 2 === 0;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.8fr 1.2fr 1.2fr 0.4fr',
                    padding: '0 20px',
                    background: isEven ? '#fff' : '#FAFBFC',
                    borderBottom: '1px solid #F8FAFC',
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                  onMouseLeave={e => e.currentTarget.style.background = isEven ? '#fff' : '#FAFBFC'}
                >
                  {/* Event Badge */}
                  <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: ev.bg, color: ev.color, whiteSpace: 'nowrap' }}>
                      {ev.icon}
                      {ev.label}
                    </span>
                  </div>

                  {/* User */}
                  <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {log.user ? (
                      <>
                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0, background: 'linear-gradient(135deg, #60A5FA, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff' }}>
                          {getInitials(log.user.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.user.name}</p>
                          <p style={{ fontSize: '10px', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.user.email}</p>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Activity size={12} style={{ color: '#9CA3AF' }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>System</span>
                      </div>
                    )}
                  </div>

                  {/* Paper */}
                  <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center' }}>
                    {log.paperId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={12} style={{ color: '#6B7280', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#374151', background: '#F3F4F6', padding: '2px 8px', borderRadius: '6px' }}>
                          {log.metadata?.paperTitle || log.paperId.slice(0, 8) + '...'}
                        </span>
                        <motion.button
                          onClick={() => handleCopy(log.paperId, log.id)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedId === log.id ? '#22C55E' : '#9CA3AF', padding: '2px', display: 'flex' }}
                          title="Copy full ID"
                        >
                          {copiedId === log.id ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                        </motion.button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#9CA3AF', background: '#F9FAFB', padding: '3px 10px', borderRadius: '6px', border: '1px solid #F3F4F6' }}>
                        System Event
                      </span>
                    )}
                  </div>

                  {/* Time */}
                  <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{timeAgo(log.createdAt)}</p>
                    <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>{new Date(log.createdAt).toLocaleString()}</p>
                  </div>

                  {/* Copy Action */}
                  <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <motion.button
                      onClick={() => handleCopy(JSON.stringify(log.metadata || {}), `meta-${log.id}`)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedId === `meta-${log.id}` ? '#22C55E' : '#D1D5DB', padding: '4px', display: 'flex', borderRadius: '6px' }}
                      title="Copy metadata"
                    >
                      {copiedId === `meta-${log.id}` ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}