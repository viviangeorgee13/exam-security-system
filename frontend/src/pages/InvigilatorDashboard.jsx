import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutDashboard, FileText, Download, Lock,
  Unlock, CheckCircle2, Clock, ShieldCheck,
  Calendar, AlertCircle, BookOpen, RefreshCw
} from 'lucide-react';
import Layout from '../components/Layout';
import CountdownTimer from '../components/CountdownTimer';
import { downloadPaper } from '../services/api';
import axios from 'axios';

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

// ─── Download Progress Modal ───────────────────────────────────────────────────

const DOWNLOAD_STEPS = [
  'Verifying permissions...',
  'Decrypting secure document...',
  'Applying forensic watermark...',
  'Embedding identity token...',
  'Authorizing download...',
];

function DownloadProgressModal({ paperTitle }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepDuration = 600;
    const interval = setInterval(() => {
      setStep(s => {
        if (s < DOWNLOAD_STEPS.length - 1) return s + 1;
        clearInterval(interval);
        return s;
      });
      setProgress(p => Math.min(p + 20, 100));
    }, stepDuration);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          background: '#fff', borderRadius: '24px', padding: '40px',
          width: '420px', boxShadow: '0 25px 80px rgba(0,0,0,0.2)',
          border: '1px solid #E5E7EB',
        }}
      >
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #EFF6FF, #EDE9FE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #BFDBFE',
          }}>
            <ShieldCheck size={36} style={{ color: '#2563EB' }} />
          </div>
        </div>

        {/* Title */}
        <p style={{ fontSize: '18px', fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: '4px' }}>
          Preparing Secure Document
        </p>
        <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', marginBottom: '28px' }}>
          {paperTitle}
        </p>

        {/* Progress Bar */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ height: '8px', borderRadius: '4px', background: '#F3F4F6', overflow: 'hidden', marginBottom: '10px' }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #2563EB, #4F46E5)' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Processing...</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB' }}>{progress}%</span>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {DOWNLOAD_STEPS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0.3 }}
              animate={{ opacity: i <= step ? 1 : 0.3 }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                background: i < step ? '#DCFCE7' : i === step ? '#DBEAFE' : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 300ms ease',
              }}>
                {i < step
                  ? <CheckCircle2 size={12} style={{ color: '#16A34A' }} />
                  : i === step
                    ? <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB', animation: 'pulse 1s infinite' }} />
                    : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D1D5DB' }} />
                }
              </div>
              <span style={{ fontSize: '13px', fontWeight: i === step ? 600 : 400, color: i <= step ? '#111827' : '#9CA3AF', transition: 'all 300ms ease' }}>
                {s}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Security badge */}
        <div style={{ marginTop: '24px', padding: '10px 14px', borderRadius: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={14} style={{ color: '#22C55E', flexShrink: 0 }} />
          <p style={{ fontSize: '11px', color: '#166534', fontWeight: 500 }}>
            Forensic watermark being embedded with your identity
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvigilatorDashboard() {
  const [papers, setPapers] = useState([]);
  const [downloading, setDownloading] = useState(null);
  const [downloadedPapers, setDownloadedPapers] = useState(new Set());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(null);

  const fetchAssignedPapers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/papers/assigned', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setPapers(res.data);
    } catch (err) {
      toast.error('Failed to load assigned papers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssignedPapers(); }, []);

  const handleDownload = async (paperId, subject, title) => {
    setDownloading(paperId);
    setShowProgress({ paperId, title });

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 3200));

    try {
      const res = await downloadPaper(paperId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam_${subject.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setDownloadedPapers(prev => new Set([...prev, paperId]));
      toast.success('Watermark embedded successfully. Download started!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Download failed. Please try again.');
    } finally {
      setShowProgress(null);
      setDownloading(null);
    }
  };

  // Derived stats
  const totalPapers = papers.length;
  const releasedPapers = papers.filter(p => p.status === 'released').length;
  const lockedPapers = papers.filter(p => p.status !== 'released').length;
  const scheduledPapers = papers.filter(p => p.releaseAt && p.status !== 'released').length;

  const getStatusConfig = (paper) => {
    if (paper.status === 'released') return {
      borderColor: '#22C55E', bg: '#F0FDF4',
      badge: { bg: '#DCFCE7', color: '#16A34A', label: 'Available' },
      icon: <Unlock size={18} style={{ color: '#22C55E' }} />,
    };
    if (paper.releaseAt) return {
      borderColor: '#F59E0B', bg: '#FFFBEB',
      badge: { bg: '#FEF3C7', color: '#D97706', label: 'Scheduled' },
      icon: <Clock size={18} style={{ color: '#F59E0B' }} />,
    };
    return {
      borderColor: '#E5E7EB', bg: '#FAFAFA',
      badge: { bg: '#F3F4F6', color: '#6B7280', label: 'Locked' },
      icon: <Lock size={18} style={{ color: '#9CA3AF' }} />,
    };
  };

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={18} />, active: activeTab === 'dashboard', onClick: () => setActiveTab('dashboard') },
    { label: 'My Papers', icon: <FileText size={18} />, active: activeTab === 'papers', onClick: () => setActiveTab('papers') },
  ];

  const PaperCard = ({ paper }) => {
    const statusConfig = getStatusConfig(paper);
    const isDownloaded = downloadedPapers.has(paper.id);
    const isDownloading = downloading === paper.id;

    return (
      <motion.div
        whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.10)' }}
        style={{
          background: statusConfig.bg, borderRadius: '16px', padding: '20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: `1.5px solid ${statusConfig.borderColor}`,
          transition: 'all 200ms ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {statusConfig.icon}
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: statusConfig.badge.bg, color: statusConfig.badge.color }}>
            {statusConfig.badge.label}
          </span>
        </div>

        {/* Info */}
        <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{paper.title}</p>
        <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>{paper.subject}</p>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          {paper.examDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={12} style={{ color: '#6B7280' }} />
              <span style={{ fontSize: '11px', color: '#6B7280' }}>
                Exam Date: {new Date(paper.examDate).toLocaleDateString()}
              </span>
            </div>
          )}
          {paper.status === 'released' && paper.releaseAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Unlock size={12} style={{ color: '#16A34A' }} />
              <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
                Released {timeAgo(paper.releaseAt)}
              </span>
            </div>
          )}
          {paper.status !== 'released' && paper.releaseAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={12} style={{ color: '#D97706' }} />
              <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600 }}>
                Releases: {new Date(paper.releaseAt).toLocaleString()}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={12} style={{ color: '#22C55E' }} />
            <span style={{ fontSize: '11px', color: '#6B7280' }}>AES-256 Encrypted</span>
          </div>
        </div>

        {/* Countdown */}
        {paper.status !== 'released' && paper.releaseAt && (
          <div style={{ marginBottom: '14px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.7)', border: '1px solid #FDE68A' }}>
            <p style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Releases in</p>
            <CountdownTimer releaseAt={paper.releaseAt} onReleased={fetchAssignedPapers} />
          </div>
        )}

        {/* Not scheduled */}
        {paper.status !== 'released' && !paper.releaseAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', padding: '8px 12px', borderRadius: '8px', background: '#F3F4F6' }}>
            <AlertCircle size={14} style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Not yet scheduled</span>
          </div>
        )}

        {/* Download Button */}
        <motion.button
          onClick={() => paper.status === 'released' && !isDownloaded && !isDownloading && handleDownload(paper.id, paper.subject, paper.title)}
          disabled={paper.status !== 'released' || isDownloading}
          whileHover={paper.status === 'released' && !isDownloaded ? { y: -2, boxShadow: '0 8px 20px rgba(37,99,235,0.3)' } : {}}
          whileTap={paper.status === 'released' && !isDownloaded ? { scale: 0.97 } : {}}
          style={{
            width: '100%', height: '44px', borderRadius: '12px', border: 'none',
            fontSize: '13px', fontWeight: 600,
            cursor: paper.status === 'released' && !isDownloaded ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: isDownloaded
              ? '#DCFCE7'
              : paper.status === 'released'
                ? 'linear-gradient(90deg, #2563EB, #4F46E5)'
                : '#E5E7EB',
            color: isDownloaded ? '#16A34A' : paper.status === 'released' ? '#fff' : '#9CA3AF',
            boxShadow: paper.status === 'released' && !isDownloaded ? '0 4px 14px rgba(37,99,235,0.22)' : 'none',
            transition: 'all 300ms ease',
          }}
        >
          {isDownloaded ? (
            <><CheckCircle2 size={15} /> Downloaded</>
          ) : paper.status === 'released' ? (
            <><Download size={15} /> Download Paper</>
          ) : (
            <><Lock size={15} /> Not Yet Available</>
          )}
        </motion.button>
      </motion.div>
    );
  };

  return (
    <Layout navItems={navItems}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* Download Progress Modal */}
      <AnimatePresence>
        {showProgress && (
          <DownloadProgressModal paperTitle={showProgress.title} />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ── Dashboard ─────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>My Dashboard</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>View and download your assigned exam papers</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <StatCard icon={<BookOpen size={20} />} label="Assigned Papers" value={totalPapers} bg="#DBEAFE" color="#2563EB" sublabel="Total assigned" />
              <StatCard icon={<CheckCircle2 size={20} />} label="Available" value={releasedPapers} bg="#DCFCE7" color="#16A34A" sublabel="Ready to download" />
              <StatCard icon={<Clock size={20} />} label="Scheduled" value={scheduledPapers} bg="#FEF3C7" color="#D97706" sublabel="Awaiting release" />
              <StatCard icon={<Lock size={20} />} label="Locked" value={lockedPapers} bg="#F3F4F6" color="#6B7280" sublabel="Not yet scheduled" />
            </div>

            {/* Available + Upcoming */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Unlock size={16} style={{ color: '#16A34A' }} />
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Available Now</p>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: '#DCFCE7', color: '#16A34A' }}>
                    {releasedPapers} papers
                  </span>
                </div>
                {releasedPapers === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
                    <Lock size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '13px' }}>No papers available yet</p>
                  </div>
                ) : papers.filter(p => p.status === 'released').map((paper, i) => {
                  const isDownloaded = downloadedPapers.has(paper.id);
                  return (
                    <motion.div key={paper.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '12px', background: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: '8px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={16} style={{ color: '#16A34A' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{paper.title}</p>
                          <p style={{ fontSize: '11px', color: '#6B7280' }}>{paper.subject}</p>
                          {paper.releaseAt && (
                            <p style={{ fontSize: '10px', color: '#16A34A', fontWeight: 600, marginTop: '2px' }}>
                              Released {timeAgo(paper.releaseAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      <motion.button
                        onClick={() => !isDownloaded && handleDownload(paper.id, paper.subject, paper.title)}
                        disabled={isDownloaded || downloading === paper.id}
                        whileHover={!isDownloaded ? { y: -2, boxShadow: '0 6px 16px rgba(37,99,235,0.3)' } : {}}
                        whileTap={!isDownloaded ? { scale: 0.97 } : {}}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                          borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: 600,
                          cursor: isDownloaded ? 'not-allowed' : 'pointer',
                          background: isDownloaded ? '#DCFCE7' : 'linear-gradient(90deg, #2563EB, #4F46E5)',
                          color: isDownloaded ? '#16A34A' : '#fff',
                          transition: 'all 300ms ease',
                        }}
                      >
                        {isDownloaded ? <><CheckCircle2 size={13} /> Downloaded</> : <><Download size={13} /> Download</>}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </Card>

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={16} style={{ color: '#D97706' }} />
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Upcoming Releases</p>
                  </div>
                  <motion.button onClick={fetchAssignedPapers} whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
                    <RefreshCw size={14} />
                  </motion.button>
                </div>
                {scheduledPapers === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
                    <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '13px' }}>No upcoming releases</p>
                  </div>
                ) : papers.filter(p => p.releaseAt && p.status !== 'released').map((paper, i) => (
                  <motion.div key={paper.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ padding: '12px', borderRadius: '12px', background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: '8px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Clock size={16} style={{ color: '#D97706' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{paper.title}</p>
                        <p style={{ fontSize: '11px', color: '#6B7280' }}>{paper.subject}</p>
                        <p style={{ fontSize: '10px', color: '#D97706', fontWeight: 600, marginTop: '2px' }}>
                          {new Date(paper.releaseAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.7)', border: '1px solid #FDE68A' }}>
                      <CountdownTimer releaseAt={paper.releaseAt} onReleased={fetchAssignedPapers} />
                    </div>
                  </motion.div>
                ))}
              </Card>
            </div>

            {/* Security Notice */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ marginTop: '20px', padding: '16px 20px', borderRadius: '14px', background: 'linear-gradient(135deg, #F8FAFF, #EEF4FF)', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '14px' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={20} style={{ color: '#2563EB' }} />
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF' }}>Secure Download Notice</p>
                <p style={{ fontSize: '12px', color: '#3B82F6', marginTop: '2px' }}>
                  Every downloaded copy is uniquely watermarked with your name, email, and a forensic token. Unauthorized sharing is traceable.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ── My Papers ─────────────────────────────────────────── */}
        {activeTab === 'papers' && (
          <motion.div key="papers" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>My Papers</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                  {totalPapers} paper{totalPapers !== 1 ? 's' : ''} assigned to you
                </p>
              </div>
              <motion.button onClick={fetchAssignedPapers} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                <RefreshCw size={14} /> Refresh
              </motion.button>
            </div>

            {papers.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '60px' }}>
                <BookOpen size={52} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>No papers assigned</p>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '6px' }}>Contact your administrator to get papers assigned to you</p>
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {papers.map((paper, i) => (
                  <motion.div key={paper.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <PaperCard paper={paper} />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Security Notice */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              style={{ marginTop: '20px', padding: '16px 20px', borderRadius: '14px', background: 'linear-gradient(135deg, #F8FAFF, #EEF4FF)', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '14px' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={20} style={{ color: '#2563EB' }} />
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF' }}>Secure Download Notice</p>
                <p style={{ fontSize: '12px', color: '#3B82F6', marginTop: '2px' }}>
                  Every downloaded copy is uniquely watermarked with your name, email, and a forensic token. Unauthorized sharing is traceable.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </Layout>
  );
}