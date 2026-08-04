import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutDashboard, Users, ClipboardList, AlertTriangle,
  UserPlus, ShieldAlert, CheckCircle2, Activity,
  Search, Download, Upload, Unlock, Lock,
  ArrowRight, Eye, RefreshCw, FileDown, Shield, Sparkles, Clock
} from 'lucide-react';
import Layout from '../components/Layout';
import AuditLogTable from '../components/AuditLogTable';
import AnomalyCard from '../components/AnomalyCard';
import HashVerificationModal from '../components/HashVerificationModal';
import {
  getUsers, createUser, toggleUserActive,
  getAuditLogs, verifyHashChain,
  getAnomalies, getAnomalyStats,
  getDownloads,
} from '../services/api';

// ─── Shared Primitives ────────────────────────────────────────────────────────

const Card = ({ children, style = {} }) => (
  <div style={{
    background: '#fff', borderRadius: '16px', padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6',
    ...style,
  }}>
    {children}
  </div>
);

const StatCard = ({ icon, label, value, bg, sublabel }) => (
  <motion.div
    whileHover={{ y: -5, boxShadow: '0 16px 40px rgba(0,0,0,0.12)' }}
    transition={{ duration: 0.2 }}
    style={{
      background: '#fff', borderRadius: '16px', padding: '20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <p style={{ fontSize: '28px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px', fontWeight: 500 }}>{label}</p>
        {sublabel && <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '3px' }}>{sublabel}</p>}
      </div>
      <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
    </div>
  </motion.div>
);

const GradientButton = ({ onClick, disabled, loading, children, style = {}, variant = 'primary', type = 'button' }) => {
  const variants = {
    primary: { background: disabled ? '#93C5FD' : 'linear-gradient(90deg, #2563EB, #4F46E5)', color: '#fff', border: 'none' },
    danger: { background: '#FEE2E2', color: '#EF4444', border: '1px solid #FECACA' },
    secondary: { background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' },
    success: { background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' },
  };
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { y: -2, boxShadow: variant === 'primary' ? '0 8px 20px rgba(37,99,235,0.3)' : '0 4px 12px rgba(0,0,0,0.1)' } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      style={{
        borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
        gap: '6px', transition: 'all 200ms ease', ...variants[variant], ...style,
      }}
    >
      {loading && (
        <div style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      )}
      {children}
    </motion.button>
  );
};

const inputStyle = {
  width: '100%', height: '42px', borderRadius: '10px',
  border: '1.5px solid #E5E7EB', background: '#F9FAFB',
  color: '#111827', fontSize: '13px', padding: '0 12px',
  outline: 'none', transition: 'all 200ms ease', boxSizing: 'border-box',
};
const focusInput = e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; e.target.style.background = '#fff'; };
const blurInput = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F9FAFB'; };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getEventIcon(eventType) {
  if (eventType === 'PAPER_UPLOADED') return { icon: <Upload size={13} />, bg: '#EFF6FF', color: '#2563EB' };
  if (eventType === 'PAPER_DOWNLOADED') return { icon: <Download size={13} />, bg: '#F0FDF4', color: '#16A34A' };
  if (eventType === 'PAPER_RELEASED') return { icon: <Unlock size={13} />, bg: '#F0FDF4', color: '#16A34A' };
  if (eventType === 'PERMISSION_GRANTED') return { icon: <Users size={13} />, bg: '#EDE9FE', color: '#7C3AED' };
  if (eventType === 'ANOMALY_DETECTED') return { icon: <AlertTriangle size={13} />, bg: '#FEF2F2', color: '#EF4444' };
  if (eventType === 'ADMIN_ACTION') return { icon: <ShieldAlert size={13} />, bg: '#FEF3C7', color: '#D97706' };
  if (eventType === 'USER_LOGIN') return { icon: <Eye size={13} />, bg: '#F3F4F6', color: '#6B7280' };
  return { icon: <Activity size={13} />, bg: '#F3F4F6', color: '#6B7280' };
}

function getEventLabel(eventType) {
  const labels = {
    PAPER_UPLOADED: 'Paper uploaded',
    PAPER_DOWNLOADED: 'Paper downloaded',
    PAPER_RELEASED: 'Paper released',
    PERMISSION_GRANTED: 'Permission granted',
    PERMISSION_REVOKED: 'Permission revoked',
    ANOMALY_DETECTED: 'Anomaly detected',
    ADMIN_ACTION: 'Admin action',
    USER_LOGIN: 'User logged in',
    USER_LOGOUT: 'User logged out',
    AI_QUERY: 'AI Assistant queried',
  };
  return labels[eventType] || eventType;
}

function getRoleBadge(role) {
  const styles = {
    super_admin: { bg: '#EDE9FE', color: '#7C3AED', label: 'Super Admin' },
    admin: { bg: '#DBEAFE', color: '#2563EB', label: 'Admin' },
    invigilator: { bg: '#DCFCE7', color: '#16A34A', label: 'Invigilator' },
  };
  const s = styles[role] || styles.invigilator;
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
// ─── AI Daily Summary Component ───────────────────────────────────────────────

function AIDailySummary() {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  const generateSummary = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: 'Summarise today\'s activity and system health',
          history: [],
        }),
      });
      const data = await res.json();
      setSummary(data.answer || 'Unable to generate summary.');
      setGenerated(true);
      setGeneratedAt(new Date());
    } catch (e) {
      setSummary('Failed to generate summary. Please try again.');
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  };

  const formatSummary = (text) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} style={{ fontWeight: 700, color: '#111827', fontSize: '14px', marginBottom: '8px', marginTop: i > 0 ? '16px' : 0 }}>{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.match(/^\*\*(.+)\*\*$/)) {
        return <p key={i} style={{ fontWeight: 700, color: '#111827', fontSize: '14px', marginBottom: '8px', marginTop: i > 0 ? '16px' : 0 }}>{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <span style={{ color: '#2563EB', flexShrink: 0 }}>•</span>
            <span style={{ color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>{line.replace(/^[*\-•]\s/, '').replace(/\*\*/g, '')}</span>
          </div>
        );
      }
      if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
      return <p key={i} style={{ color: '#374151', fontSize: '14px', marginBottom: '4px', lineHeight: 1.6 }}>{line.replace(/\*\*/g, '')}</p>;
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>AI Daily Summary</h2>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <motion.button
          onClick={generateSummary}
          disabled={loading}
          whileHover={!loading ? { y: -2, boxShadow: '0 8px 20px rgba(37,99,235,0.3)' } : {}}
          whileTap={!loading ? { scale: 0.97 } : {}}
          style={{
            background: loading ? '#93C5FD' : 'linear-gradient(90deg, #2563EB, #4F46E5)',
            color: '#fff', border: 'none', borderRadius: '12px',
            padding: '12px 20px', fontSize: '13px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 14px rgba(37,99,235,0.22)',
          }}
        >
          {loading ? (
            <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          ) : <Sparkles size={16} />}
          {loading ? 'Generating...' : generated ? 'Regenerate' : 'Generate Summary'}
        </motion.button>
      </div>

      {/* Not generated yet */}
      {!generated && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: '#fff', borderRadius: '20px', padding: '60px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6',
            textAlign: 'center',
          }}
        >
          <div style={{
            width: '80px', height: '80px', borderRadius: '24px',
            background: 'linear-gradient(135deg, #EFF6FF, #EDE9FE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', border: '1px solid #BFDBFE',
          }}>
            <Sparkles size={40} style={{ color: '#2563EB' }} />
          </div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
            Generate Your Daily Briefing
          </p>
          <p style={{ fontSize: '13px', color: '#6B7280', maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            The AI will analyse today's system activity, downloads, anomalies, and audit logs to generate a comprehensive security briefing.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Today\'s Downloads', 'Security Anomalies', 'Audit Activity', 'System Health', 'Recommendations'].map((item, i) => (
              <span key={i} style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', background: '#F3F4F6', color: '#6B7280' }}>
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: '#fff', borderRadius: '20px', padding: '60px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ y: [-8, 0, -8] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2563EB' }}
              />
            ))}
          </div>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
            Analysing System Activity...
          </p>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            ExamSecure AI is reviewing today's data
          </p>
        </motion.div>
      )}

      {/* Summary Result */}
      {generated && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Summary Card */}
          <div style={{
            background: '#fff', borderRadius: '20px', overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6',
            marginBottom: '16px',
          }}>
            {/* Card Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1e3a8a, #2563EB, #4F46E5)',
              padding: '20px 28px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Sparkles size={22} style={{ color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Daily Security Briefing</p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                    Generated by ExamSecure AI • {generatedAt?.toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.15)' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E' }} />
                <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>Live Data</span>
              </div>
            </div>

            {/* Summary Content */}
            <div style={{ padding: '28px' }}>
              {formatSummary(summary)}
            </div>
          </div>

          {/* Footer note */}
          <div style={{ padding: '14px 20px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={16} style={{ color: '#6B7280', flexShrink: 0 }} />
            <p style={{ fontSize: '12px', color: '#6B7280' }}>
              This summary is generated from live system data using ExamSecure AI. Powered by Groq • Llama 3.1 8B • Role-restricted to Super Administrators only.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [stats, setStats] = useState(null);
  const [hashResult, setHashResult] = useState(null);
  const [showHashModal, setShowHashModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [downloadSearch, setDownloadSearch] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'invigilator' });

  const fetchUsers = useCallback(async () => {
    try { const res = await getUsers(); setUsers(res.data); } catch (e) {}
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try { const res = await getAuditLogs(); setAuditLogs(res.data); } catch (e) {}
  }, []);

  const fetchAnomalies = useCallback(async () => {
    try { const res = await getAnomalies(); setAnomalies(res.data); } catch (e) {}
  }, []);

  const fetchStats = useCallback(async () => {
    try { const res = await getAnomalyStats(); setStats(res.data); } catch (e) {}
  }, []);

  const fetchDownloads = useCallback(async () => {
    try { const res = await getDownloads(); setDownloads(res.data); } catch (e) {}
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'anomalies') fetchAnomalies();
    if (activeTab === 'downloads') fetchDownloads();
  }, [activeTab]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser(newUser);
      toast.success(`User "${newUser.name}" created successfully!`);
      setNewUser({ name: '', email: '', password: '', role: 'invigilator' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally { setLoading(false); }
  };

  const handleToggleActive = async (id) => {
    try {
      await toggleUserActive(id);
      fetchUsers();
      toast.success('User status updated');
    } catch (e) { toast.error('Failed to update user status'); }
  };

  const handleVerifyChain = () => setShowHashModal(true);

  const performVerification = async () => {
    try {
      const res = await verifyHashChain();
      setHashResult(res.data);
      return res.data;
    } catch (e) {
      return { valid: false, message: 'Verification failed' };
    }
  };

  const recentActivity = auditLogs.slice(0, 8);
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDownloads = downloads.filter(d =>
    d.user?.name?.toLowerCase().includes(downloadSearch.toLowerCase()) ||
    d.user?.email?.toLowerCase().includes(downloadSearch.toLowerCase()) ||
    d.paper?.title?.toLowerCase().includes(downloadSearch.toLowerCase()) ||
    d.downloadToken?.toLowerCase().includes(downloadSearch.toLowerCase())
  );
  const adminCount = users.filter(u => u.role === 'admin').length;
  const invigilatorCount = users.filter(u => u.role === 'invigilator').length;
  const activeUsers = users.filter(u => u.isActive).length;
  const todayDownloads = downloads.filter(d => new Date(d.downloadedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length;

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={18} />, active: activeTab === 'dashboard', onClick: () => setActiveTab('dashboard') },
    { label: 'User Management', icon: <Users size={18} />, active: activeTab === 'users', onClick: () => setActiveTab('users') },
    { label: 'Audit Logs', icon: <ClipboardList size={18} />, active: activeTab === 'audit', onClick: () => setActiveTab('audit') },
    { label: 'Downloads', icon: <FileDown size={18} />, active: activeTab === 'downloads', onClick: () => setActiveTab('downloads') },
    { label: 'Anomalies', icon: <AlertTriangle size={18} />, active: activeTab === 'anomalies', onClick: () => setActiveTab('anomalies') },
    { label: 'AI Summary', icon: <Sparkles size={18} />, active: activeTab === 'summary', onClick: () => setActiveTab('summary') },
    { label: 'Timeline', icon: <Clock size={18} />, active: activeTab === 'timeline', onClick: () => setActiveTab('timeline') },
  ];

  return (
    <Layout navItems={navItems}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <AnimatePresence>
        {showHashModal && (
          <HashVerificationModal
            onVerify={performVerification}
            onClose={() => setShowHashModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ── Dashboard ─────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>System Overview</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Monitor all users, security events and system health</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <StatCard icon={<Users size={20} style={{ color: '#2563EB' }} />} label="Total Users" value={users.length} bg="#DBEAFE" sublabel={`${activeUsers} active`} />
              <StatCard icon={<AlertTriangle size={20} style={{ color: '#F59E0B' }} />} label="Open Anomalies" value={stats?.unresolved ?? '—'} bg="#FEF3C7" sublabel="Needs review" />
              <StatCard icon={<ShieldAlert size={20} style={{ color: '#EF4444' }} />} label="High Risk" value={stats?.highRisk ?? '—'} bg="#FEE2E2" sublabel="Score ≥ 80" />
              <StatCard icon={<CheckCircle2 size={20} style={{ color: '#22C55E' }} />} label="Resolved" value={stats?.resolved ?? '—'} bg="#DCFCE7" sublabel="All time" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Activity size={16} style={{ color: '#2563EB' }} />
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Recent Activity</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 2px #DCFCE7' }} />
                    <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: 600 }}>Live</span>
                  </div>
                </div>
                {recentActivity.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
                    <Activity size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '13px' }}>No activity yet</p>
                  </div>
                ) : recentActivity.map((log, i) => {
                  const ev = getEventIcon(log.eventType);
                  return (
                    <motion.div key={log.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                    >
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: ev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ev.color, flexShrink: 0 }}>
                        {ev.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getEventLabel(log.eventType)}</p>
                        <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{log.user?.name || 'System'}</p>
                      </div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{timeAgo(log.createdAt)}</p>
                    </motion.div>
                  );
                })}
                <button onClick={() => setActiveTab('audit')} style={{ marginTop: '12px', fontSize: '12px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  View all logs <ArrowRight size={12} />
                </button>
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={16} style={{ color: '#7C3AED' }} />
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>User Breakdown</p>
                    </div>
                    <button onClick={() => setActiveTab('users')} style={{ fontSize: '12px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Manage <ArrowRight size={12} />
                    </button>
                  </div>
                  {[
                    { label: 'Administrators', value: adminCount, total: users.length, color: '#2563EB' },
                    { label: 'Invigilators', value: invigilatorCount, total: users.length, color: '#16A34A' },
                    { label: 'Active Accounts', value: activeUsers, total: users.length, color: '#7C3AED' },
                  ].map((item, i) => (
                    <div key={i} style={{ marginBottom: i < 2 ? '14px' : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{item.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{item.value}/{item.total}</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '4px', background: '#F3F4F6', overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          style={{ height: '100%', borderRadius: '4px', background: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </Card>

                <Card>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Quick Actions</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Create New User', desc: 'Add admin or invigilator', icon: <UserPlus size={16} />, bg: '#EFF6FF', color: '#2563EB', action: () => setActiveTab('users') },
                      { label: 'View Anomalies', desc: `${stats?.unresolved ?? 0} unresolved alerts`, icon: <AlertTriangle size={16} />, bg: stats?.unresolved > 0 ? '#FEF2F2' : '#F3F4F6', color: stats?.unresolved > 0 ? '#EF4444' : '#6B7280', action: () => setActiveTab('anomalies') },
                      { label: 'Verify Hash Chain', desc: 'Check audit log integrity', icon: <ShieldAlert size={16} />, bg: '#F0FDF4', color: '#16A34A', action: handleVerifyChain },
                    ].map((action, i) => (
                      <motion.button key={i} onClick={action.action} whileHover={{ x: 4 }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #F3F4F6', background: '#FAFAFA', cursor: 'pointer', textAlign: 'left', transition: 'all 200ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = action.color; e.currentTarget.style.background = action.bg; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#F3F4F6'; e.currentTarget.style.background = '#FAFAFA'; }}
                      >
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, flexShrink: 0 }}>
                          {action.icon}
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{action.label}</p>
                          <p style={{ fontSize: '11px', color: '#6B7280' }}>{action.desc}</p>
                        </div>
                        <ArrowRight size={14} style={{ color: '#D1D5DB', marginLeft: 'auto' }} />
                      </motion.button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
            {/* Security Health Card */}
<Card style={{ marginTop: '20px' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShieldAlert size={16} style={{ color: '#16A34A' }} />
      </div>
      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Security Health</p>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ fontSize: '28px', fontWeight: 800, color: stats?.unresolved > 0 ? '#D97706' : '#16A34A' }}>
        {stats?.unresolved > 0 ? Math.max(70, 95 - stats.unresolved * 5) : 95}
      </div>
      <div>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280' }}>/ 100</p>
        <p style={{ fontSize: '10px', color: '#9CA3AF' }}>Security Score</p>
      </div>
    </div>
  </div>

  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
    {[
      { label: 'JWT Authentication', status: 'online', icon: <CheckCircle2 size={14} /> },
      { label: 'AES-256 Encryption', status: 'online', icon: <CheckCircle2 size={14} /> },
      { label: 'Scheduler Running', status: 'online', icon: <CheckCircle2 size={14} /> },
      { label: 'AI Assistant Online', status: 'online', icon: <CheckCircle2 size={14} /> },
      { label: 'Hash Chain Intact', status: hashResult?.valid === false ? 'warning' : 'online', icon: hashResult?.valid === false ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} /> },
      { label: `${stats?.unresolved ?? 0} Risk Alerts`, status: stats?.unresolved > 0 ? 'warning' : 'online', icon: stats?.unresolved > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} /> },
    ].map((item, i) => (
      <div key={i} style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 14px', borderRadius: '10px',
        background: item.status === 'warning' ? '#FEF3C7' : '#F0FDF4',
        border: `1px solid ${item.status === 'warning' ? '#FDE68A' : '#BBF7D0'}`,
      }}>
        <span style={{ color: item.status === 'warning' ? '#D97706' : '#16A34A', flexShrink: 0 }}>
          {item.icon}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: item.status === 'warning' ? '#92400E' : '#166534' }}>
          {item.label}
        </span>
      </div>
    ))}
  </div>
</Card>
          </motion.div>
        )}

        {/* ── Users ─────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>User Management</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Create and manage all system users</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px' }}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={16} style={{ color: '#2563EB' }} />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Create New User</p>
                </div>
                <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { placeholder: 'Full Name', field: 'name', type: 'text' },
                    { placeholder: 'Email Address', field: 'email', type: 'email' },
                    { placeholder: 'Password (min 8 chars)', field: 'password', type: 'password' },
                  ].map(f => (
                    <input key={f.field} type={f.type} placeholder={f.placeholder} value={newUser[f.field]} onChange={e => setNewUser({ ...newUser, [f.field]: e.target.value })} required style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
                  ))}
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="invigilator">Invigilator</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <GradientButton type="submit" disabled={loading} loading={loading} style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                    {!loading && <UserPlus size={14} />}
                    {loading ? 'Creating...' : 'Create User'}
                  </GradientButton>
                </form>
              </Card>

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={16} style={{ color: '#7C3AED' }} />
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>All Users ({filteredUsers.length})</p>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                    <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: '180px', paddingLeft: '30px', height: '36px' }} onFocus={focusInput} onBlur={blurInput} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
                  {filteredUsers.map((u, i) => (
                    <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', border: '1px solid #F3F4F6', background: u.isActive ? '#FAFAFA' : '#FEF9F9' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: u.isActive ? 'linear-gradient(135deg, #60A5FA, #818CF8)' : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: u.isActive ? '#fff' : '#9CA3AF' }}>
                          {u.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{u.name}</p>
                          <p style={{ fontSize: '11px', color: '#6B7280' }}>{u.email}</p>
                          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {getRoleBadge(u.role)}
                            <span style={{ fontSize: '10px', color: u.isActive ? '#22C55E' : '#EF4444', fontWeight: 600 }}>● {u.isActive ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                      </div>
                      {u.role !== 'super_admin' && (
                        <motion.button onClick={() => handleToggleActive(u.id)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', border: 'none', background: u.isActive ? '#FEE2E2' : '#DCFCE7', color: u.isActive ? '#EF4444' : '#16A34A', transition: 'all 200ms ease' }}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </motion.button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ── Audit ─────────────────────────────────────────────── */}
        {activeTab === 'audit' && (
          <motion.div key="audit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <AuditLogTable
              logs={auditLogs}
              onVerify={handleVerifyChain}
              onRefresh={fetchAuditLogs}
              verifyLoading={false}
              hashResult={hashResult}
            />
          </motion.div>
        )}

        {/* ── Downloads ─────────────────────────────────────────── */}
        {activeTab === 'downloads' && (
          <motion.div key="downloads" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Download History</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                  All watermarked downloads with forensic tokens — {downloads.length} total
                </p>
              </div>
              <GradientButton onClick={fetchDownloads} variant="secondary">
                <RefreshCw size={14} /> Refresh
              </GradientButton>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <StatCard icon={<FileDown size={20} style={{ color: '#16A34A' }} />} label="Total Downloads" value={downloads.length} bg="#DCFCE7" sublabel="All time" />
              <StatCard icon={<Download size={20} style={{ color: '#2563EB' }} />} label="Today's Downloads" value={todayDownloads} bg="#DBEAFE" sublabel="Last 24 hours" />
              <StatCard icon={<Shield size={20} style={{ color: '#7C3AED' }} />} label="Unique Papers" value={new Set(downloads.map(d => d.paperId)).size} bg="#EDE9FE" sublabel="Downloaded papers" />
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                placeholder="Search by user, paper, or token..."
                value={downloadSearch}
                onChange={e => setDownloadSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '40px', height: '44px', borderRadius: '12px' }}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>

            {/* Downloads Table */}
            {filteredDownloads.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '60px' }}>
                <FileDown size={48} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No downloads found</p>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Downloads will appear here after invigilators access papers</p>
              </Card>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1.2fr 0.8fr', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', padding: '12px 20px' }}>
                  {['Invigilator', 'Paper', 'Token', 'Downloaded At', 'IP Address'].map((h, i) => (
                    <div key={i} style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>

                {/* Table Rows */}
                <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
                  {filteredDownloads.map((d, i) => (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      style={{
                        display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1.2fr 0.8fr',
                        padding: '14px 20px',
                        background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                        borderBottom: '1px solid #F8FAFC',
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFBFC'}
                    >
                      {/* Invigilator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #60A5FA, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {d.user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{d.user?.name}</p>
                          <p style={{ fontSize: '10px', color: '#9CA3AF' }}>{d.user?.email}</p>
                        </div>
                      </div>

                      {/* Paper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileDown size={14} style={{ color: '#16A34A', flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{d.paper?.title}</p>
                          <p style={{ fontSize: '10px', color: '#9CA3AF' }}>{d.paper?.subject}</p>
                        </div>
                      </div>

                      {/* Token */}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#374151', background: '#F3F4F6', padding: '2px 8px', borderRadius: '6px' }}>
                          {d.downloadToken?.slice(0, 8)}...
                        </span>
                      </div>

                      {/* Downloaded At */}
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{timeAgo(d.downloadedAt)}</p>
                        <p style={{ fontSize: '10px', color: '#9CA3AF' }}>{new Date(d.downloadedAt).toLocaleString()}</p>
                      </div>

                      {/* IP */}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6B7280' }}>{d.ipAddress || '—'}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {/* ── Anomalies ─────────────────────────────────────────── */}
        {activeTab === 'anomalies' && (
          <motion.div key="anomalies" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Security Anomalies</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Suspicious activity detected by the anomaly engine</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {stats && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px', background: '#FEF3C7', color: '#D97706' }}>{stats.unresolved} Open</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px', background: '#DCFCE7', color: '#16A34A' }}>{stats.resolved} Resolved</span>
                  </div>
                )}
                <GradientButton onClick={fetchAnomalies} variant="secondary">
                  <RefreshCw size={14} /> Refresh
                </GradientButton>
              </div>
            </div>
            {anomalies.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '60px' }}>
                <CheckCircle2 size={52} style={{ color: '#22C55E', margin: '0 auto 16px' }} />
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>No anomalies detected</p>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '6px' }}>All system activity appears normal</p>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {anomalies.map((anomaly, i) => (
                  <motion.div key={anomaly.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <AnomalyCard anomaly={anomaly} onResolved={fetchAnomalies} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
        {/* ── AI Summary ────────────────────────────────────────── */}
{activeTab === 'summary' && (
  <motion.div key="summary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
    <AIDailySummary />
  </motion.div>
)}
        {/* ── Activity Timeline ─────────────────────────────────── */}
{activeTab === 'timeline' && (
  <motion.div key="timeline" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Activity Timeline</h2>
        <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
          A visual story of all system events in chronological order
        </p>
      </div>
      <GradientButton onClick={fetchAuditLogs} variant="secondary">
        <RefreshCw size={14} /> Refresh
      </GradientButton>
    </div>

    {auditLogs.length === 0 ? (
      <Card style={{ textAlign: 'center', padding: '60px' }}>
        <Activity size={48} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
        <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No activity yet</p>
      </Card>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Timeline */}
        <Card style={{ padding: '28px' }}>
          <div style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute', left: '15px', top: '8px', bottom: '8px',
              width: '2px', background: 'linear-gradient(180deg, #2563EB, #4F46E5, #7C3AED)',
              borderRadius: '2px', opacity: 0.2,
            }} />

            {auditLogs.slice(0, 20).map((log, i) => {
              const configs = {
                PAPER_UPLOADED:     { icon: '📤', color: '#2563EB', bg: '#DBEAFE', label: 'Paper Uploaded' },
                PAPER_DOWNLOADED:   { icon: '📥', color: '#16A34A', bg: '#DCFCE7', label: 'Paper Downloaded' },
                PAPER_RELEASED:     { icon: '🔓', color: '#16A34A', bg: '#DCFCE7', label: 'Paper Released' },
                PAPER_ACCESSED:     { icon: '👁️', color: '#6B7280', bg: '#F3F4F6', label: 'Paper Accessed' },
                PERMISSION_GRANTED: { icon: '✅', color: '#7C3AED', bg: '#EDE9FE', label: 'Permission Granted' },
                PERMISSION_REVOKED: { icon: '❌', color: '#EF4444', bg: '#FEE2E2', label: 'Permission Revoked' },
                ANOMALY_DETECTED:   { icon: '🚨', color: '#EF4444', bg: '#FEE2E2', label: 'Anomaly Detected' },
                ADMIN_ACTION:       { icon: '⚙️', color: '#D97706', bg: '#FEF3C7', label: 'Admin Action' },
                USER_LOGIN:         { icon: '🟢', color: '#16A34A', bg: '#DCFCE7', label: 'User Login' },
                USER_LOGOUT:        { icon: '🔴', color: '#6B7280', bg: '#F3F4F6', label: 'User Logout' },
                AI_QUERY:           { icon: '🤖', color: '#7C3AED', bg: '#EDE9FE', label: 'AI Query' },
                PAPER_SCHEDULED:    { icon: '📅', color: '#D97706', bg: '#FEF3C7', label: 'Paper Scheduled' },
              };
              const config = configs[log.eventType] || { icon: '📋', color: '#6B7280', bg: '#F3F4F6', label: log.eventType };

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  style={{ display: 'flex', gap: '16px', marginBottom: '20px', position: 'relative' }}
                >
                  {/* Timeline dot */}
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: config.bg, border: `2px solid ${config.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', zIndex: 1,
                    boxShadow: `0 0 0 4px ${config.bg}`,
                  }}>
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                          {config.label}
                        </p>
                        {log.user && (
                          <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                            {log.user.name} • {log.user.role.replace('_', ' ')}
                          </p>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0, marginLeft: '8px' }}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {auditLogs.length > 20 && (
              <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', paddingLeft: '48px' }}>
                Showing 20 of {auditLogs.length} events
              </p>
            )}
          </div>
        </Card>

        {/* Right side — Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Event breakdown */}
          <Card>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Event Breakdown</p>
            {(() => {
              const counts = {};
              auditLogs.forEach(l => { counts[l.eventType] = (counts[l.eventType] || 0) + 1; });
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
              const total = auditLogs.length;
              const colors = ['#2563EB', '#7C3AED', '#16A34A', '#D97706', '#EF4444', '#6B7280'];
              return sorted.map(([type, count], i) => (
                <div key={type} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                      {type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: colors[i] }}>{count}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '4px', background: '#F3F4F6', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / total) * 100}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      style={{ height: '100%', borderRadius: '4px', background: colors[i] }}
                    />
                  </div>
                </div>
              ));
            })()}
          </Card>

          {/* Today's summary */}
          <Card>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Today's Summary</p>
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const todayLogs = auditLogs.filter(l => new Date(l.createdAt) >= today);
              const stats = [
                { label: 'Total Events', value: todayLogs.length, color: '#2563EB' },
                { label: 'Logins', value: todayLogs.filter(l => l.eventType === 'USER_LOGIN').length, color: '#16A34A' },
                { label: 'Downloads', value: todayLogs.filter(l => l.eventType === 'PAPER_DOWNLOADED').length, color: '#7C3AED' },
                { label: 'Anomalies', value: todayLogs.filter(l => l.eventType === 'ANOMALY_DETECTED').length, color: '#EF4444' },
                { label: 'AI Queries', value: todayLogs.filter(l => l.eventType === 'AI_QUERY').length, color: '#D97706' },
              ];
              return stats.map((stat, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < stats.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{stat.label}</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: stat.color }}>{stat.value}</span>
                </div>
              ));
            })()}
          </Card>

          {/* Most active user */}
          <Card>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Most Active Users</p>
            {(() => {
              const userCounts = {};
              auditLogs.forEach(l => {
                if (l.user) {
                  if (!userCounts[l.user.name]) userCounts[l.user.name] = { count: 0, email: l.user.email, role: l.user.role };
                  userCounts[l.user.name].count++;
                }
              });
              return Object.entries(userCounts)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 4)
                .map(([name, data], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #60A5FA, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                        {name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{name}</p>
                        <p style={{ fontSize: '10px', color: '#9CA3AF' }}>{data.role.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB' }}>{data.count} events</span>
                  </div>
                ));
            })()}
          </Card>
        </div>
      </div>
    )}
  </motion.div>
)}
      </AnimatePresence>
    </Layout>
  );
}