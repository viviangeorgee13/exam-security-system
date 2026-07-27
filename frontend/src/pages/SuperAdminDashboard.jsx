import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutDashboard, Users, ClipboardList, AlertTriangle,
  UserPlus, ShieldAlert, CheckCircle2, Activity,
  Search, Download, Upload, Unlock, Lock,
  ArrowRight, TrendingUp, Eye, RefreshCw
} from 'lucide-react';
import Layout from '../components/Layout';
import AuditLogTable from '../components/AuditLogTable';
import AnomalyCard from '../components/AnomalyCard';
import {
  getUsers, createUser, toggleUserActive,
  getAuditLogs, verifyHashChain,
  getAnomalies, getAnomalyStats,
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState(null);
  const [hashResult, setHashResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'anomalies') fetchAnomalies();
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

  const handleVerifyChain = async () => {
    setLoading(true);
    try {
      const res = await verifyHashChain();
      setHashResult(res.data);
      if (res.data.valid) toast.success('Hash chain verified — all entries intact!');
      else toast.error('Hash chain broken — tampering detected!');
    } catch (e) {} finally { setLoading(false); }
  };

  // Derived data
  const recentActivity = auditLogs.slice(0, 8);
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const adminCount = users.filter(u => u.role === 'admin').length;
  const invigilatorCount = users.filter(u => u.role === 'invigilator').length;
  const activeUsers = users.filter(u => u.isActive).length;

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={18} />, active: activeTab === 'dashboard', onClick: () => setActiveTab('dashboard') },
    { label: 'User Management', icon: <Users size={18} />, active: activeTab === 'users', onClick: () => setActiveTab('users') },
    { label: 'Audit Logs', icon: <ClipboardList size={18} />, active: activeTab === 'audit', onClick: () => setActiveTab('audit') },
    { label: 'Anomalies', icon: <AlertTriangle size={18} />, active: activeTab === 'anomalies', onClick: () => setActiveTab('anomalies') },
  ];

  return (
    <Layout navItems={navItems}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <AnimatePresence mode="wait">

        {/* ── Dashboard ─────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>

            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>System Overview</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                Monitor all users, security events and system health
              </p>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <StatCard icon={<Users size={20} style={{ color: '#2563EB' }} />} label="Total Users" value={users.length} bg="#DBEAFE" sublabel={`${activeUsers} active`} />
              <StatCard icon={<AlertTriangle size={20} style={{ color: '#F59E0B' }} />} label="Open Anomalies" value={stats?.unresolved ?? '—'} bg="#FEF3C7" sublabel="Needs review" />
              <StatCard icon={<ShieldAlert size={20} style={{ color: '#EF4444' }} />} label="High Risk" value={stats?.highRisk ?? '—'} bg="#FEE2E2" sublabel="Score ≥ 80" />
              <StatCard icon={<CheckCircle2 size={20} style={{ color: '#22C55E' }} />} label="Resolved" value={stats?.resolved ?? '—'} bg="#DCFCE7" sublabel="All time" />
            </div>

            {/* Main grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

              {/* Recent Activity */}
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
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                    >
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: ev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ev.color, flexShrink: 0 }}>
                        {ev.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getEventLabel(log.eventType)}
                        </p>
                        <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{log.user?.name || 'System'}</p>
                      </div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{timeAgo(log.createdAt)}</p>
                    </motion.div>
                  );
                })}
                <button
                  onClick={() => setActiveTab('audit')}
                  style={{ marginTop: '12px', fontSize: '12px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  View all logs <ArrowRight size={12} />
                </button>
              </Card>

              {/* User Breakdown + Quick Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* User Breakdown */}
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
                    { label: 'Administrators', value: adminCount, total: users.length, color: '#2563EB', bg: '#DBEAFE' },
                    { label: 'Invigilators', value: invigilatorCount, total: users.length, color: '#16A34A', bg: '#DCFCE7' },
                    { label: 'Active Accounts', value: activeUsers, total: users.length, color: '#7C3AED', bg: '#EDE9FE' },
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

                {/* Quick Actions */}
                <Card>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Quick Actions</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Create New User', desc: 'Add admin or invigilator', icon: <UserPlus size={16} />, bg: '#EFF6FF', color: '#2563EB', tab: 'users' },
                      { label: 'View Anomalies', desc: `${stats?.unresolved ?? 0} unresolved alerts`, icon: <AlertTriangle size={16} />, bg: stats?.unresolved > 0 ? '#FEF2F2' : '#F3F4F6', color: stats?.unresolved > 0 ? '#EF4444' : '#6B7280', tab: 'anomalies' },
                      { label: 'Verify Hash Chain', desc: 'Check audit log integrity', icon: <ShieldAlert size={16} />, bg: '#F0FDF4', color: '#16A34A', action: handleVerifyChain },
                    ].map((action, i) => (
                      <motion.button
                        key={i}
                        onClick={action.tab ? () => setActiveTab(action.tab) : action.action}
                        whileHover={{ x: 4 }}
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

            {/* Hash Result Banner */}
            <AnimatePresence>
              {hashResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ padding: '14px 18px', borderRadius: '12px', marginBottom: '16px', background: hashResult.valid ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${hashResult.valid ? '#BBF7D0' : '#FECACA'}`, color: hashResult.valid ? '#166534' : '#991B1B', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {hashResult.valid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {hashResult.message}
                </motion.div>
              )}
            </AnimatePresence>
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

              {/* Create User */}
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

              {/* Users List */}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredUsers.map((u, i) => (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
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
                            <span style={{ fontSize: '10px', color: u.isActive ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
                              ● {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {u.role !== 'super_admin' && (
                        <motion.button
                          onClick={() => handleToggleActive(u.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Audit Logs</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                  Tamper-proof hash-chained event log — {auditLogs.length} entries
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <GradientButton onClick={fetchAuditLogs} variant="secondary">
                  <RefreshCw size={14} /> Refresh
                </GradientButton>
                <GradientButton onClick={handleVerifyChain} disabled={loading} loading={loading}>
                  {!loading && <ShieldAlert size={14} />}
                  {loading ? 'Verifying...' : 'Verify Hash Chain'}
                </GradientButton>
              </div>
            </div>

            <AnimatePresence>
              {hashResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ padding: '14px 18px', borderRadius: '12px', marginBottom: '16px', background: hashResult.valid ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${hashResult.valid ? '#BBF7D0' : '#FECACA'}`, color: hashResult.valid ? '#166534' : '#991B1B', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {hashResult.valid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {hashResult.message}
                  {hashResult.brokenAt && (
                    <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                      — Broken at entry {hashResult.brokenAt.index} (ID: {hashResult.brokenAt.logId?.slice(0, 8)}...)
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <AuditLogTable logs={auditLogs} />
            </Card>
          </motion.div>
        )}

        {/* ── Anomalies ─────────────────────────────────────────── */}
        {activeTab === 'anomalies' && (
          <motion.div key="anomalies" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Security Anomalies</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                  Suspicious activity detected by the anomaly engine
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {stats && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px', background: '#FEF3C7', color: '#D97706' }}>
                      {stats.unresolved} Open
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px', background: '#DCFCE7', color: '#16A34A' }}>
                      {stats.resolved} Resolved
                    </span>
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
                  <motion.div
                    key={anomaly.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <AnomalyCard anomaly={anomaly} onResolved={fetchAnomalies} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </Layout>
  );
}