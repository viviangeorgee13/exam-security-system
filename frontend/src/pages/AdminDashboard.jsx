import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutDashboard, FileText, Upload, Calendar,
  Users, Lock, Unlock, Trash2, CheckCircle2,
  Clock, ShieldCheck, AlertCircle, FolderOpen,
  ArrowRight, Activity, Download, Eye,
  ChevronRight, Circle
} from 'lucide-react';
import Layout from '../components/Layout';
import CountdownTimer from '../components/CountdownTimer';
import BulkUploadPanel from '../components/BulkUploadPanel';
import {
  getPapers, uploadPaper, deletePaper, schedulePaper,
  getPermissions, grantPermission, revokePermission,
  getAuditLogs, getDownloads,
} from '../services/api';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

const StatCard = ({ icon, label, value, bg, color, sublabel }) => (
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
      <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
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
    warning: { background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' },
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

function getStatusBadge(paper) {
  if (paper.isReleased) return { label: 'Released', bg: '#DCFCE7', color: '#16A34A' };
  if (paper.releaseAt) return { label: 'Scheduled', bg: '#FEF3C7', color: '#D97706' };
  return { label: 'Pending', bg: '#F3F4F6', color: '#6B7280' };
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

// ─── Paper Lifecycle Component ────────────────────────────────────────────────

function PaperLifecycle({ paper, downloads, permissions }) {
  const paperDownloads = downloads.filter(d => d.paperId === paper.id);
  const paperPermissions = permissions.filter(p => p.paperId === paper.id && p.isActive);

  const steps = [
    {
      label: 'Uploaded',
      desc: `By ${paper.uploader?.name || 'Unknown'}`,
      time: paper.createdAt,
      done: true,
      icon: <Upload size={14} />,
      color: '#2563EB', bg: '#DBEAFE',
    },
    {
      label: 'Encrypted',
      desc: 'AES-256-CBC encryption applied',
      time: paper.createdAt,
      done: true,
      icon: <ShieldCheck size={14} />,
      color: '#7C3AED', bg: '#EDE9FE',
    },
    {
      label: 'Scheduled',
      desc: paper.releaseAt ? new Date(paper.releaseAt).toLocaleString() : 'Not yet scheduled',
      time: paper.releaseAt,
      done: !!paper.releaseAt,
      icon: <Calendar size={14} />,
      color: '#D97706', bg: '#FEF3C7',
    },
    {
      label: 'Released',
      desc: paper.isReleased ? `Released at ${new Date(paper.releaseAt).toLocaleTimeString()}` : 'Awaiting release time',
      time: paper.isReleased ? paper.releaseAt : null,
      done: paper.isReleased,
      icon: <Unlock size={14} />,
      color: '#16A34A', bg: '#DCFCE7',
    },
    {
      label: 'Downloaded',
      desc: paperDownloads.length > 0 ? `${paperDownloads.length} invigilator${paperDownloads.length > 1 ? 's' : ''}` : 'No downloads yet',
      time: paperDownloads.length > 0 ? paperDownloads[paperDownloads.length - 1]?.downloadedAt : null,
      done: paperDownloads.length > 0,
      icon: <Download size={14} />,
      color: '#22C55E', bg: '#DCFCE7',
    },
  ];

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(0,0,0,0.10)' }}
      style={{
        background: '#fff', borderRadius: '16px', padding: '20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6',
        marginBottom: '16px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={22} style={{ color: '#2563EB' }} />
          </div>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{paper.title}</p>
            <p style={{ fontSize: '12px', color: '#6B7280' }}>{paper.subject} • {new Date(paper.examDate).toLocaleDateString()}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {paperPermissions.length > 0 && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#EDE9FE', color: '#7C3AED' }}>
              {paperPermissions.length} assigned
            </span>
          )}
          {(() => {
            const badge = getStatusBadge(paper);
            return (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              {/* Step Circle */}
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: step.done ? step.bg : '#F3F4F6',
                  border: `2px solid ${step.done ? step.color : '#E5E7EB'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: step.done ? step.color : '#9CA3AF',
                  marginBottom: '8px', flexShrink: 0,
                  boxShadow: step.done ? `0 0 0 4px ${step.bg}` : 'none',
                  transition: 'all 300ms ease',
                }}
              >
                {step.done ? step.icon : <Circle size={10} style={{ color: '#D1D5DB' }} />}
              </motion.div>
              {/* Step Label */}
              <p style={{ fontSize: '11px', fontWeight: step.done ? 700 : 400, color: step.done ? '#111827' : '#9CA3AF', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {step.label}
              </p>
              <p style={{ fontSize: '9px', color: step.done ? '#6B7280' : '#D1D5DB', textAlign: 'center', maxWidth: '80px', lineHeight: 1.3, marginTop: '2px' }}>
                {step.done && step.time ? timeAgo(step.time) : step.done ? step.desc.slice(0, 20) : '—'}
              </p>
            </div>
            {/* Connector Line */}
            {i < steps.length - 1 && (
              <div style={{
                height: '2px', flex: 0.3, marginBottom: '28px',
                background: steps[i + 1].done ? `linear-gradient(90deg, ${step.color}, ${steps[i + 1].color})` : '#E5E7EB',
                transition: 'all 300ms ease',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Downloads detail */}
      {paperDownloads.length > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#166534', marginBottom: '8px' }}>Download Records</p>
          {paperDownloads.slice(0, 3).map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < paperDownloads.length - 1 ? '4px' : 0 }}>
              <p style={{ fontSize: '12px', color: '#374151' }}>{d.user?.name || 'Unknown'}</p>
              <p style={{ fontSize: '11px', color: '#6B7280' }}>{timeAgo(d.downloadedAt)}</p>
            </div>
          ))}
          {paperDownloads.length > 3 && (
            <p style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px' }}>+{paperDownloads.length - 3} more downloads</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [papers, setPapers] = useState([]);
  const [invigilators, setInvigilators] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', subject: '', examDate: '', releaseAt: '', file: null });
  const [scheduleForm, setScheduleForm] = useState({ paperId: '', releaseAt: '' });

  const fetchPapers = useCallback(async () => {
    try { const res = await getPapers(); setPapers(res.data); } catch (e) {}
  }, []);

  const fetchInvigilators = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/invigilators`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setInvigilators(res.data);
    } catch (e) {}
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try { const res = await getAuditLogs(); setAuditLogs(res.data); } catch (e) {}
  }, []);

  const fetchDownloads = useCallback(async () => {
    try { const res = await getDownloads(); setDownloads(res.data); } catch (e) {}
  }, []);

  const fetchAllPermissions = useCallback(async (papersList) => {
    try {
      const allPerms = [];
      for (const paper of papersList) {
        try {
          const res = await getPermissions(paper.id);
          allPerms.push(...res.data.permissions.map(p => ({ ...p, paperId: paper.id })));
        } catch (e) {}
      }
      setAllPermissions(allPerms);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchPapers();
    fetchInvigilators();
    fetchAuditLogs();
    fetchDownloads();
  }, []);

  useEffect(() => {
    if (papers.length > 0) fetchAllPermissions(papers);
  }, [papers]);

  useEffect(() => {
    if (activeTab === 'lifecycle') {
      fetchDownloads();
      fetchAllPermissions(papers);
    }
  }, [activeTab]);

  const fetchPermissions = async (paperId) => {
    try { const res = await getPermissions(paperId); setPermissions(res.data.permissions); } catch (e) {}
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', uploadForm.title);
      formData.append('subject', uploadForm.subject);
      formData.append('examDate', uploadForm.examDate);
      if (uploadForm.releaseAt) formData.append('releaseAt', uploadForm.releaseAt);
      formData.append('file', uploadForm.file);
      await uploadPaper(formData);
      toast.success('Paper uploaded and encrypted successfully!');
      setUploadForm({ title: '', subject: '', examDate: '', releaseAt: '', file: null });
      fetchPapers();
      fetchAuditLogs();
      setActiveTab('papers');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this paper?')) return;
    try {
      await deletePaper(id);
      toast.success('Paper deleted successfully');
      fetchPapers();
    } catch (e) { toast.error('Failed to delete paper'); }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    try {
      await schedulePaper(scheduleForm.paperId, scheduleForm.releaseAt);
      toast.success('Release time updated successfully!');
      setScheduleForm({ paperId: '', releaseAt: '' });
      fetchPapers();
      fetchAuditLogs();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to schedule'); }
  };

  const handleSelectPaper = (paper) => {
    setSelectedPaper(paper);
    fetchPermissions(paper.id);
  };

  const handleGrantPermission = async (userId) => {
    try {
      await grantPermission(selectedPaper.id, userId);
      toast.success('Access granted successfully');
      fetchPermissions(selectedPaper.id);
      fetchAuditLogs();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to grant permission'); }
  };

  const handleRevokePermission = async (userId) => {
    try {
      await revokePermission(selectedPaper.id, userId);
      toast.success('Access revoked');
      fetchPermissions(selectedPaper.id);
    } catch (e) { toast.error('Failed to revoke permission'); }
  };

  const released = papers.filter(p => p.isReleased).length;
  const scheduled = papers.filter(p => !p.isReleased && p.releaseAt).length;
  const pending = papers.filter(p => !p.isReleased && !p.releaseAt).length;
  const todayDownloads = downloads.filter(d => new Date(d.downloadedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length;
  const recentActivity = auditLogs.slice(0, 6);
  const upcomingReleases = papers
    .filter(p => !p.isReleased && p.releaseAt)
    .sort((a, b) => new Date(a.releaseAt) - new Date(b.releaseAt))
    .slice(0, 4);

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={18} />, active: activeTab === 'dashboard', onClick: () => setActiveTab('dashboard') },
    { label: 'All Papers', icon: <FileText size={18} />, active: activeTab === 'papers', onClick: () => setActiveTab('papers') },
    { label: 'Upload Paper', icon: <Upload size={18} />, active: activeTab === 'upload', onClick: () => setActiveTab('upload') },
    { label: 'Bulk Upload', icon: <FolderOpen size={18} />, active: activeTab === 'bulk', onClick: () => setActiveTab('bulk') },
    { label: 'Schedule', icon: <Calendar size={18} />, active: activeTab === 'schedule', onClick: () => setActiveTab('schedule') },
    { label: 'Permissions', icon: <Users size={18} />, active: activeTab === 'permissions', onClick: () => setActiveTab('permissions') },
    { label: 'Paper Lifecycle', icon: <Activity size={18} />, active: activeTab === 'lifecycle', onClick: () => setActiveTab('lifecycle') },
  ];

  return (
    <Layout navItems={navItems}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <AnimatePresence mode="wait">

        {/* ── Dashboard ─────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Dashboard Overview</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Monitor papers, schedules, permissions and secure releases</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <StatCard icon={<FileText size={20} />} label="Total Papers" value={papers.length} bg="#DBEAFE" color="#2563EB" sublabel="All time" />
              <StatCard icon={<CheckCircle2 size={20} />} label="Released" value={released} bg="#DCFCE7" color="#16A34A" sublabel="Available to invigilators" />
              <StatCard icon={<Clock size={20} />} label="Scheduled" value={scheduled} bg="#FEF3C7" color="#D97706" sublabel="Awaiting release" />
              <StatCard icon={<Download size={20} />} label="Downloads Today" value={todayDownloads} bg="#EDE9FE" color="#7C3AED" sublabel="Last 24 hours" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              {/* Upcoming Releases */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={16} style={{ color: '#D97706' }} />
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Upcoming Releases</p>
                  </div>
                  <button onClick={() => setActiveTab('schedule')} style={{ fontSize: '12px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    View all <ArrowRight size={12} />
                  </button>
                </div>
                {upcomingReleases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
                    <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ fontSize: '13px' }}>No upcoming releases</p>
                    <button onClick={() => setActiveTab('schedule')} style={{ marginTop: '8px', fontSize: '12px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Schedule a paper →
                    </button>
                  </div>
                ) : upcomingReleases.map((paper, i) => (
                  <motion.div key={paper.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < upcomingReleases.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Clock size={16} style={{ color: '#D97706' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paper.title}</p>
                      <p style={{ fontSize: '11px', color: '#6B7280' }}>{paper.subject}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <CountdownTimer releaseAt={paper.releaseAt} onReleased={fetchPapers} />
                    </div>
                  </motion.div>
                ))}
              </Card>

              {/* Recent Activity */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Activity size={16} style={{ color: '#2563EB' }} />
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Recent Activity</p>
                  </div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 2px #DCFCE7' }} />
                </div>
                {recentActivity.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
                    <Activity size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ fontSize: '13px' }}>No recent activity</p>
                  </div>
                ) : recentActivity.map((log, i) => (
                  <motion.div key={log.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Activity size={13} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getEventLabel(log.eventType)}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{log.user?.name || 'System'}</p>
                    </div>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{timeAgo(log.createdAt)}</p>
                  </motion.div>
                ))}
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>Quick Actions</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { label: 'Upload New Paper', desc: 'Encrypt and upload a PDF', icon: <Upload size={20} />, bg: '#EFF6FF', color: '#2563EB', tab: 'upload' },
                  { label: 'Schedule a Release', desc: 'Set time-lock for papers', icon: <Calendar size={20} />, bg: '#FEF3C7', color: '#D97706', tab: 'schedule' },
                  { label: 'Manage Permissions', desc: 'Assign invigilators', icon: <Users size={20} />, bg: '#EDE9FE', color: '#7C3AED', tab: 'permissions' },
                ].map(action => (
                  <motion.button key={action.tab} onClick={() => setActiveTab(action.tab)} whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }} whileTap={{ scale: 0.97 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '12px', border: '1.5px solid #F3F4F6', background: '#FAFAFA', cursor: 'pointer', textAlign: 'left', transition: 'all 200ms ease' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = action.color; e.currentTarget.style.background = action.bg; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#F3F4F6'; e.currentTarget.style.background = '#FAFAFA'; }}
                  >
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, flexShrink: 0 }}>
                      {action.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{action.label}</p>
                      <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{action.desc}</p>
                    </div>
                    <ArrowRight size={16} style={{ color: '#D1D5DB', marginLeft: 'auto' }} />
                  </motion.button>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
        {/* Operations Summary Card */}
<Card style={{ marginTop: '20px' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Activity size={16} style={{ color: '#2563EB' }} />
    </div>
    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Today's Operations</p>
  </div>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
    {[
      { label: 'Total Papers', value: papers.length, color: '#2563EB', bg: '#DBEAFE' },
      { label: 'Released', value: released, color: '#16A34A', bg: '#DCFCE7' },
      { label: 'Scheduled', value: scheduled, color: '#D97706', bg: '#FEF3C7' },
      { label: 'Downloads Today', value: todayDownloads, color: '#7C3AED', bg: '#EDE9FE' },
      { label: 'Pending', value: pending, color: '#6B7280', bg: '#F3F4F6' },
    ].map((item, i) => (
      <motion.div
        key={i}
        whileHover={{ y: -3 }}
        style={{ textAlign: 'center', padding: '16px 12px', borderRadius: '12px', background: item.bg }}
      >
        <p style={{ fontSize: '24px', fontWeight: 800, color: item.color }}>{item.value}</p>
        <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', fontWeight: 500 }}>{item.label}</p>
      </motion.div>
    ))}
  </div>
</Card>

        {/* ── All Papers ────────────────────────────────────────── */}
        {activeTab === 'papers' && (
          <motion.div key="papers" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>All Papers</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{papers.length} paper{papers.length !== 1 ? 's' : ''} total</p>
              </div>
              <GradientButton onClick={() => setActiveTab('upload')}>
                <Upload size={14} /> Upload Paper
              </GradientButton>
            </div>
            {papers.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '60px' }}>
                <FolderOpen size={48} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No papers uploaded yet</p>
                <GradientButton onClick={() => setActiveTab('upload')} style={{ margin: '20px auto 0' }}>
                  <Upload size={14} /> Upload Paper
                </GradientButton>
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {papers.map((paper, i) => {
                  const badge = getStatusBadge(paper);
                  return (
                    <motion.div key={paper.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.10)' }}
                      style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={22} style={{ color: '#2563EB' }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </div>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{paper.title}</p>
                      <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>{paper.subject}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={12} style={{ color: '#22C55E' }} />
                          <span style={{ fontSize: '11px', color: '#6B7280' }}>AES-256 Encrypted</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={12} style={{ color: '#6B7280' }} />
                          <span style={{ fontSize: '11px', color: '#6B7280' }}>Exam: {new Date(paper.examDate).toLocaleDateString()}</span>
                        </div>
                        {paper.uploader && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Users size={12} style={{ color: '#6B7280' }} />
                            <span style={{ fontSize: '11px', color: '#6B7280' }}>By: {paper.uploader.name}</span>
                          </div>
                        )}
                      </div>
                      {paper.releaseAt && !paper.isReleased && (
                        <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                          <CountdownTimer releaseAt={paper.releaseAt} onReleased={fetchPapers} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <GradientButton onClick={() => { setScheduleForm({ ...scheduleForm, paperId: paper.id }); setActiveTab('schedule'); }} variant="secondary" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: '12px' }}>
                          <Calendar size={12} /> Schedule
                        </GradientButton>
                        <GradientButton onClick={() => { handleSelectPaper(paper); setActiveTab('permissions'); }} variant="warning" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: '12px' }}>
                          <Users size={12} /> Assign
                        </GradientButton>
                        <GradientButton onClick={() => handleDelete(paper.id)} variant="danger" style={{ padding: '8px 12px' }}>
                          <Trash2 size={13} />
                        </GradientButton>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Upload ────────────────────────────────────────────── */}
        {activeTab === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Upload Paper</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Upload and encrypt a new exam paper securely</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Card>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '20px' }}>Paper Details</p>
                <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { label: 'Paper Title', placeholder: 'e.g. Mathematics Final Exam', field: 'title', type: 'text' },
                    { label: 'Subject', placeholder: 'e.g. Mathematics', field: 'subject', type: 'text' },
                  ].map(f => (
                    <div key={f.field}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>{f.label}</label>
                      <input type={f.type} placeholder={f.placeholder} value={uploadForm[f.field]} onChange={e => setUploadForm({ ...uploadForm, [f.field]: e.target.value })} required style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Exam Date</label>
                    <input type="date" value={uploadForm.examDate} onChange={e => setUploadForm({ ...uploadForm, examDate: e.target.value })} required style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                      Release Time <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input type="datetime-local" value={uploadForm.releaseAt} onChange={e => setUploadForm({ ...uploadForm, releaseAt: e.target.value })} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>PDF File</label>
                    <input type="file" accept=".pdf" onChange={e => setUploadForm({ ...uploadForm, file: e.target.files[0] })} required style={{ fontSize: '13px', color: '#374151', width: '100%' }} />
                  </div>
                  <GradientButton type="submit" disabled={loading} loading={loading} style={{ width: '100%', justifyContent: 'center', height: '44px', marginTop: '4px' }}>
                    {!loading && <Upload size={15} />}
                    {loading ? 'Encrypting & Uploading...' : 'Upload & Encrypt'}
                  </GradientButton>
                </form>
              </Card>
              <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F8FAFF, #EEF4FF)', border: '2px dashed #BFDBFE' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', border: '1px solid #BFDBFE' }}>
                  <ShieldCheck size={36} style={{ color: '#2563EB' }} />
                </div>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Secure Upload</p>
                <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', marginBottom: '24px', maxWidth: '240px' }}>
                  Your paper is encrypted with AES-256-CBC before storage
                </p>
                {[
                  { icon: <Lock size={13} />, label: 'AES-256-CBC Encryption', color: '#2563EB', bg: '#EFF6FF' },
                  { icon: <ShieldCheck size={13} />, label: 'SHA-256 Integrity Hash', color: '#7C3AED', bg: '#EDE9FE' },
                  { icon: <CheckCircle2 size={13} />, label: 'Original File Deleted', color: '#16A34A', bg: '#DCFCE7' },
                  { icon: <Eye size={13} />, label: 'Key Stored Encrypted', color: '#D97706', bg: '#FEF3C7' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '10px', background: '#fff', marginBottom: '8px', border: '1px solid #F3F4F6', width: '100%', maxWidth: '280px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>{item.label}</span>
                  </div>
                ))}
                {uploadForm.file && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0', width: '100%', maxWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={15} style={{ color: '#22C55E', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#166534' }}>{uploadForm.file.name}</p>
                        <p style={{ fontSize: '11px', color: '#4ADE80' }}>{(uploadForm.file.size / 1024).toFixed(1)} KB — Ready</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </Card>
            </div>
          </motion.div>
        )}

        {/* ── Schedule ──────────────────────────────────────────── */}
        {activeTab === 'schedule' && (
          <motion.div key="schedule" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Schedule Release</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Set the time-lock release for exam papers</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Card>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '20px' }}>Set Release Time</p>
                <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Select Paper</label>
                    <select value={scheduleForm.paperId} onChange={e => setScheduleForm({ ...scheduleForm, paperId: e.target.value })} required style={{ ...inputStyle, cursor: 'pointer' }} onFocus={focusInput} onBlur={blurInput}>
                      <option value="">— Select a paper —</option>
                      {papers.filter(p => !p.isReleased).map(p => (
                        <option key={p.id} value={p.id}>{p.title} — {p.subject}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Release Date & Time</label>
                    <input type="datetime-local" value={scheduleForm.releaseAt} onChange={e => setScheduleForm({ ...scheduleForm, releaseAt: e.target.value })} required style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
                  </div>
                  <GradientButton type="submit" style={{ width: '100%', justifyContent: 'center', height: '44px' }}>
                    <Calendar size={15} /> Set Release Time
                  </GradientButton>
                </form>
              </Card>
              <Card>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Paper Timeline</p>
                {papers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#9CA3AF' }}>
                    <Calendar size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '13px' }}>No papers available</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {papers.map((paper, i) => {
                      const badge = getStatusBadge(paper);
                      return (
                        <motion.div key={paper.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                          style={{ padding: '14px', borderRadius: '12px', border: '1px solid #F3F4F6', background: '#FAFAFA' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{paper.title}</p>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                          </div>
                          <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '8px' }}>{paper.subject}</p>
                          {paper.releaseAt && !paper.isReleased && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={12} style={{ color: '#D97706' }} />
                              <CountdownTimer releaseAt={paper.releaseAt} onReleased={fetchPapers} />
                            </div>
                          )}
                          {paper.isReleased && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Unlock size={12} style={{ color: '#22C55E' }} />
                              <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: 600 }}>Released {paper.releaseAt ? new Date(paper.releaseAt).toLocaleString() : ''}</span>
                            </div>
                          )}
                          {!paper.releaseAt && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Lock size={12} style={{ color: '#9CA3AF' }} />
                              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>No release time set</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </motion.div>
        )}

        {/* ── Permissions ───────────────────────────────────────── */}
        {activeTab === 'permissions' && (
          <motion.div key="permissions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Permission Management</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Control which invigilators can access each paper</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
              <Card>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>Select Paper</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {papers.map(paper => {
                    const badge = getStatusBadge(paper);
                    const isSelected = selectedPaper?.id === paper.id;
                    return (
                      <motion.div key={paper.id} onClick={() => handleSelectPaper(paper)} whileHover={{ x: 3 }}
                        style={{ padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', border: `1.5px solid ${isSelected ? '#2563EB' : '#F3F4F6'}`, background: isSelected ? '#EFF6FF' : '#FAFAFA', transition: 'all 200ms ease' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#2563EB' : '#111827' }}>{paper.title}</p>
                            <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{paper.subject}</p>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>

              {selectedPaper ? (
                <Card>
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Invigilators for "{selectedPaper.title}"</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '3px' }}>Grant or revoke access for each invigilator</p>
                  </div>
                  {invigilators.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#9CA3AF' }}>
                      <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                      <p style={{ fontSize: '13px' }}>No invigilators found</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {invigilators.map((inv, i) => {
                        const hasPermission = permissions.find(p => p.invigilator.id === inv.id && p.isActive);
                        return (
                          <motion.div key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${hasPermission ? '#BBF7D0' : '#F3F4F6'}`, background: hasPermission ? '#F0FDF4' : '#FAFAFA', transition: 'all 300ms ease' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: hasPermission ? 'linear-gradient(135deg, #34D399, #059669)' : 'linear-gradient(135deg, #60A5FA, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                                {inv.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{inv.name}</p>
                                <p style={{ fontSize: '11px', color: '#6B7280' }}>{inv.email}</p>
                                {hasPermission && <p style={{ fontSize: '10px', color: '#22C55E', fontWeight: 600, marginTop: '2px' }}>✓ Access granted</p>}
                              </div>
                            </div>
                            {hasPermission ? (
                              <GradientButton onClick={() => handleRevokePermission(inv.id)} variant="danger" style={{ fontSize: '12px', padding: '6px 14px' }}>Revoke</GradientButton>
                            ) : (
                              <GradientButton onClick={() => handleGrantPermission(inv.id)} style={{ fontSize: '12px', padding: '6px 14px' }}>Grant</GradientButton>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ) : (
                <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', border: '2px dashed #E5E7EB' }}>
                  <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
                    <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#6B7280' }}>Select a paper</p>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>Choose a paper from the left to manage permissions</p>
                  </div>
                </Card>
              )}
            </div>
          </motion.div>
        )}

        {/* -- Bulk Upload ---------------------------------------------- */}
        {activeTab === 'bulk' && (
          <motion.div key="bulk" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <BulkUploadPanel onUploaded={() => { fetchPapers(); fetchAuditLogs(); }} />
          </motion.div>
        )}

        {/* ── Paper Lifecycle ───────────────────────────────────── */}
        {activeTab === 'lifecycle' && (
          <motion.div key="lifecycle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Paper Lifecycle Tracker</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                  Track the complete journey of each paper from upload to download
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Upload', 'Encrypt', 'Schedule', 'Release', 'Download'].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', background: '#F3F4F6' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ['#2563EB', '#7C3AED', '#D97706', '#16A34A', '#22C55E'][i] }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280' }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {papers.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '60px' }}>
                <Activity size={48} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No papers to track</p>
              </Card>
            ) : (
              papers.map(paper => (
                <PaperLifecycle
                  key={paper.id}
                  paper={paper}
                  downloads={downloads}
                  permissions={allPermissions}
                />
              ))
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </Layout>
  );
}