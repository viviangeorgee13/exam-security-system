import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutDashboard, FileText, Download, Lock,
  Unlock, CheckCircle2, Clock, ShieldCheck,
  Calendar, AlertCircle, BookOpen, RefreshCw,
  Search, Shield, User, MapPin, XCircle
} from 'lucide-react';
import Layout from '../components/Layout';
import CountdownTimer from '../components/CountdownTimer';
import { downloadPaper, getMyDownloads, verifyDownloadToken, requestDownloadOtp, verifyDownloadOtp, downloadPaperWithAuth } from '../services/api';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

const DOWNLOAD_STEPS = [
  'Verifying permissions...',
  'Decrypting secure document...',
  'Applying forensic watermark...',
  'Embedding identity token...',
  'Authorizing download...',
];
function OtpModal({ paper, onClose, onVerified }) {
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [maskedInfo, setMaskedInfo] = useState('');
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(300);

  const sendOtp = async () => {
    setSending(true);
    setError('');
    setOtp('');
    try {
      const res = await requestDownloadOtp(paper.id);
      setMaskedInfo(res.data.message || 'OTP sent to your registered email address.');
      setSecondsLeft(300);
      toast.success('OTP sent to your registered email');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send OTP. Please try again.');
    } finally {
      setSending(false);
    }
  };

    const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    sendOtp();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const handleVerify = async () => {
    if (otp.length !== 6 || verifying) return;
    setVerifying(true);
    setError('');
    try {
      const res = await verifyDownloadOtp(paper.id, otp);
      toast.success('OTP verified. Download starting...');
      onVerified(res.data.downloadAuth);
    } catch (err) {
      const msg = err.response?.data?.error || 'Verification failed. Please try again.';
      setError(msg);
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        style={{
          background: '#fff', borderRadius: '24px', overflow: 'hidden',
          width: '420px', boxShadow: '0 25px 80px rgba(0,0,0,0.2)',
          border: '1px solid #E5E7EB',
        }}
      >
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563EB, #4F46E5)' }} />

        <div style={{ padding: '32px 36px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '18px',
              background: 'linear-gradient(135deg, #EFF6FF, #EDE9FE)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #BFDBFE',
            }}>
              <ShieldCheck size={32} style={{ color: '#2563EB' }} />
            </div>
          </div>

          <p style={{ fontSize: '19px', fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: '6px' }}>
            OTP Verification
          </p>
          <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', marginBottom: '4px', lineHeight: 1.5 }}>
            {sending ? 'Sending OTP to your registered email...' : maskedInfo || 'A 6-digit OTP has been sent to your registered email address.'}
          </p>
          <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginBottom: '24px' }}>
            {paper.title}
          </p>

          <input
            type="text"
            inputMode="numeric"
            value={otp}
            autoFocus
            maxLength={6}
            onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            placeholder="______"
            disabled={sending}
            style={{
              width: '100%', height: '60px', borderRadius: '14px',
              border: `1.5px solid ${error ? '#FCA5A5' : '#E5E7EB'}`,
              background: error ? '#FEF2F2' : '#F9FAFB',
              color: '#111827', fontSize: '28px', fontWeight: 700,
              textAlign: 'center', letterSpacing: '12px',
              outline: 'none', boxSizing: 'border-box',
              fontFamily: 'monospace', transition: 'all 200ms ease',
            }}
            onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = error ? '#FCA5A5' : '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.background = error ? '#FEF2F2' : '#F9FAFB'; }}
          />

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
              <AlertCircle size={13} style={{ color: '#DC2626', flexShrink: 0 }} />
              <p style={{ fontSize: '12px', color: '#DC2626', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          <p style={{ fontSize: '11px', color: secondsLeft > 0 ? '#9CA3AF' : '#DC2626', textAlign: 'center', marginTop: '10px' }}>
            {secondsLeft > 0 ? `OTP expires in ${mm}:${ss}` : 'OTP expired — please resend'}
          </p>

          <motion.button
            onClick={handleVerify}
            disabled={otp.length !== 6 || verifying || sending}
            whileHover={otp.length === 6 && !verifying ? { y: -2, boxShadow: '0 12px 28px rgba(37,99,235,0.32)' } : {}}
            whileTap={otp.length === 6 && !verifying ? { scale: 0.98 } : {}}
            style={{
              width: '100%', height: '50px', marginTop: '20px',
              borderRadius: '14px', border: 'none',
              background: otp.length === 6 && !verifying
                ? 'linear-gradient(90deg, #2563EB, #4F46E5)' : '#E5E7EB',
              color: otp.length === 6 && !verifying ? '#fff' : '#9CA3AF',
              fontSize: '14px', fontWeight: 600,
              cursor: otp.length === 6 && !verifying ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 200ms ease',
            }}
          >
            {verifying ? (
              <>
                <div style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Verifying...
              </>
            ) : (<><ShieldCheck size={16} /> Verify OTP</>)}
          </motion.button>

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button
              onClick={sendOtp}
              disabled={sending || verifying}
              style={{
                flex: 1, height: '42px', borderRadius: '12px',
                border: '1.5px solid #E5E7EB', background: '#fff',
                color: sending ? '#9CA3AF' : '#374151',
                fontSize: '13px', fontWeight: 600,
                cursor: sending || verifying ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <RefreshCw size={14} /> Resend OTP
            </button>
            <button
              onClick={onClose}
              disabled={verifying}
              style={{
                flex: 1, height: '42px', borderRadius: '12px',
                border: '1.5px solid #E5E7EB', background: '#fff',
                color: '#6B7280', fontSize: '13px', fontWeight: 600,
                cursor: verifying ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          <div style={{
            marginTop: '20px', padding: '10px 14px', borderRadius: '12px',
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            display: 'flex', alignItems: 'center', gap: '9px',
          }}>
            <ShieldCheck size={15} style={{ color: '#22C55E', flexShrink: 0 }} />
            <p style={{ fontSize: '11px', color: '#166534', fontWeight: 500, lineHeight: 1.4 }}>
              Download requires OTP verification. This attempt is recorded in the audit log.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
function DownloadProgressModal({ paperTitle }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => {
        if (s < DOWNLOAD_STEPS.length - 1) return s + 1;
        clearInterval(interval);
        return s;
      });
      setProgress(p => Math.min(p + 20, 100));
    }, 600);
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
        <p style={{ fontSize: '18px', fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: '4px' }}>
          Preparing Secure Document
        </p>
        <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', marginBottom: '28px' }}>
          {paperTitle}
        </p>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {DOWNLOAD_STEPS.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0.3 }} animate={{ opacity: i <= step ? 1 : 0.3 }}
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

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function InvigilatorDashboard() {
  const [papers, setPapers] = useState([]);
  const [myDownloads, setMyDownloads] = useState([]);
  const [downloading, setDownloading] = useState(null);
  const [downloadedPapers, setDownloadedPapers] = useState(new Set());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(null);
  const [otpPaper, setOtpPaper] = useState(null);

  // Verify Document state
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const fetchAssignedPapers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/papers/assigned`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setPapers(res.data);
    } catch (err) {
      toast.error('Failed to load assigned papers');
    } finally { setLoading(false); }
  }, []);

  const fetchMyDownloads = useCallback(async () => {
    try {
      const res = await getMyDownloads();
      setMyDownloads(res.data);
      setDownloadedPapers(new Set(res.data.map(d => d.paperId)));
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchAssignedPapers();
    fetchMyDownloads();
  }, []);

    // Step 1: clicking Download opens the OTP modal
  const handleDownload = (paperId, subject, title) => {
    if (downloading) return;
    setOtpPaper({ id: paperId, subject, title });
  };

  // Step 2: runs only after the backend has verified the OTP
  const startVerifiedDownload = async (downloadAuth) => {
    const { id: paperId, subject, title } = otpPaper;
    setOtpPaper(null);
    setDownloading(paperId);
    setShowProgress({ paperId, title });
    await new Promise(resolve => setTimeout(resolve, 3200));
    try {
      const res = await downloadPaperWithAuth(paperId, downloadAuth);
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
      fetchMyDownloads();
      toast.success('Watermark embedded successfully. Download started!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Download failed. Please try again.');
    } finally {
      setShowProgress(null);
      setDownloading(null);
    }
  };

  const handleVerifyToken = async () => {
    if (!verifyToken.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    setVerifyError('');
    try {
      const res = await verifyDownloadToken(verifyToken.trim());
      setVerifyResult(res.data);
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Token not found. Please check and try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

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
    { label: 'My Downloads', icon: <Download size={18} />, active: activeTab === 'downloads', onClick: () => setActiveTab('downloads') },
    { label: 'Verify Document', icon: <Shield size={18} />, active: activeTab === 'verify', onClick: () => setActiveTab('verify') },
    { label: "Today's Duties", icon: <CheckCircle2 size={18} />, active: activeTab === 'duties', onClick: () => setActiveTab('duties') },
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {statusConfig.icon}
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: statusConfig.badge.bg, color: statusConfig.badge.color }}>
            {statusConfig.badge.label}
          </span>
        </div>
        <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{paper.title}</p>
        <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>{paper.subject}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          {paper.examDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={12} style={{ color: '#6B7280' }} />
              <span style={{ fontSize: '11px', color: '#6B7280' }}>Exam Date: {new Date(paper.examDate).toLocaleDateString()}</span>
            </div>
          )}
          {paper.status === 'released' && paper.releaseAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Unlock size={12} style={{ color: '#16A34A' }} />
              <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>Released {timeAgo(paper.releaseAt)}</span>
            </div>
          )}
          {paper.status !== 'released' && paper.releaseAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={12} style={{ color: '#D97706' }} />
              <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600 }}>Releases: {new Date(paper.releaseAt).toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={12} style={{ color: '#22C55E' }} />
            <span style={{ fontSize: '11px', color: '#6B7280' }}>AES-256 Encrypted</span>
          </div>
        </div>
        {paper.status !== 'released' && paper.releaseAt && (
          <div style={{ marginBottom: '14px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.7)', border: '1px solid #FDE68A' }}>
            <p style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Releases in</p>
            <CountdownTimer releaseAt={paper.releaseAt} onReleased={fetchAssignedPapers} />
          </div>
        )}
        {paper.status !== 'released' && !paper.releaseAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', padding: '8px 12px', borderRadius: '8px', background: '#F3F4F6' }}>
            <AlertCircle size={14} style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Not yet scheduled</span>
          </div>
        )}
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
            background: isDownloaded ? '#DCFCE7' : paper.status === 'released' ? 'linear-gradient(90deg, #2563EB, #4F46E5)' : '#E5E7EB',
            color: isDownloaded ? '#16A34A' : paper.status === 'released' ? '#fff' : '#9CA3AF',
            boxShadow: paper.status === 'released' && !isDownloaded ? '0 4px 14px rgba(37,99,235,0.22)' : 'none',
            transition: 'all 300ms ease',
          }}
        >
          {isDownloaded ? <><CheckCircle2 size={15} /> Downloaded</>
            : paper.status === 'released' ? <><Download size={15} /> Download Paper</>
            : <><Lock size={15} /> Not Yet Available</>}
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

      <AnimatePresence>
        {showProgress && <DownloadProgressModal paperTitle={showProgress.title} />}
                {otpPaper && (
          <OtpModal
            paper={otpPaper}
            onClose={() => setOtpPaper(null)}
            onVerified={startVerifiedDownload}
          />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <StatCard icon={<BookOpen size={20} />} label="Assigned Papers" value={totalPapers} bg="#DBEAFE" color="#2563EB" sublabel="Total assigned" />
              <StatCard icon={<CheckCircle2 size={20} />} label="Available" value={releasedPapers} bg="#DCFCE7" color="#16A34A" sublabel="Ready to download" />
              <StatCard icon={<Clock size={20} />} label="Scheduled" value={scheduledPapers} bg="#FEF3C7" color="#D97706" sublabel="Awaiting release" />
              <StatCard icon={<Download size={20} />} label="Downloaded" value={myDownloads.length} bg="#EDE9FE" color="#7C3AED" sublabel="My downloads" />
            </div>

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
                          {paper.releaseAt && <p style={{ fontSize: '10px', color: '#16A34A', fontWeight: 600, marginTop: '2px' }}>Released {timeAgo(paper.releaseAt)}</p>}
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
                        <p style={{ fontSize: '10px', color: '#D97706', fontWeight: 600, marginTop: '2px' }}>{new Date(paper.releaseAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.7)', border: '1px solid #FDE68A' }}>
                      <CountdownTimer releaseAt={paper.releaseAt} onReleased={fetchAssignedPapers} />
                    </div>
                  </motion.div>
                ))}
              </Card>
            </div>

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
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{totalPapers} paper{totalPapers !== 1 ? 's' : ''} assigned to you</p>
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
          </motion.div>
        )}

        {/* ── My Downloads ──────────────────────────────────────── */}
        {activeTab === 'downloads' && (
          <motion.div key="downloads" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>My Downloads</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{myDownloads.length} download{myDownloads.length !== 1 ? 's' : ''} recorded</p>
              </div>
              <motion.button onClick={fetchMyDownloads} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                <RefreshCw size={14} /> Refresh
              </motion.button>
            </div>
            {myDownloads.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '60px' }}>
                <Download size={52} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>No downloads yet</p>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '6px' }}>Your download history will appear here</p>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myDownloads.map((d, i) => (
                  <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={22} style={{ color: '#16A34A' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{d.paper?.title}</p>
                        <p style={{ fontSize: '12px', color: '#6B7280' }}>{d.paper?.subject}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#374151', background: '#F3F4F6', padding: '2px 8px', borderRadius: '6px' }}>
                            Token: {d.downloadToken?.slice(0, 12)}...
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{timeAgo(d.downloadedAt)}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{new Date(d.downloadedAt).toLocaleString()}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '6px' }}>
                        <ShieldCheck size={12} style={{ color: '#22C55E' }} />
                        <span style={{ fontSize: '10px', color: '#22C55E', fontWeight: 600 }}>Watermarked</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Verify Document ───────────────────────────────────── */}
        {activeTab === 'verify' && (
          <motion.div key="verify" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Verify Document</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                Verify the authenticity of a downloaded exam paper using its watermark token
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Search size={18} style={{ color: '#7C3AED' }} />
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Enter Watermark Token</p>
                </div>

                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px', lineHeight: 1.6 }}>
                  Enter the forensic token found at the bottom of every downloaded exam paper to verify its authenticity and trace its origin.
                </p>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px' }}>
                    Watermark Token
                  </label>
                  <input
                    type="text"
                    value={verifyToken}
                    onChange={e => setVerifyToken(e.target.value)}
                    placeholder="e.g. f9d81a08-0831-47fc-8821-67a4fc847ab8"
                    style={{
                      width: '100%', height: '46px', borderRadius: '12px',
                      border: '1.5px solid #E5E7EB', background: '#F9FAFB',
                      color: '#111827', fontSize: '13px', padding: '0 14px',
                      outline: 'none', transition: 'all 200ms ease', boxSizing: 'border-box',
                      fontFamily: 'monospace',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#7C3AED'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)'; e.target.style.background = '#fff'; }}
                    onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F9FAFB'; }}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyToken()}
                  />
                </div>

                <motion.button
                  onClick={handleVerifyToken}
                  disabled={!verifyToken.trim() || verifyLoading}
                  whileHover={verifyToken.trim() && !verifyLoading ? { y: -2, boxShadow: '0 8px 20px rgba(124,58,237,0.3)' } : {}}
                  whileTap={verifyToken.trim() && !verifyLoading ? { scale: 0.97 } : {}}
                  style={{
                    width: '100%', height: '46px', borderRadius: '12px', border: 'none',
                    background: verifyToken.trim() && !verifyLoading
                      ? 'linear-gradient(90deg, #7C3AED, #4F46E5)'
                      : '#E5E7EB',
                    color: verifyToken.trim() && !verifyLoading ? '#fff' : '#9CA3AF',
                    fontSize: '14px', fontWeight: 600,
                    cursor: verifyToken.trim() && !verifyLoading ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'all 200ms ease',
                  }}
                >
                  {verifyLoading ? (
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  ) : <Shield size={16} />}
                  {verifyLoading ? 'Verifying...' : 'Verify Document'}
                </motion.button>

                {/* My tokens quick select */}
                {myDownloads.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                      My Recent Tokens
                    </p>
                    {myDownloads.slice(0, 3).map((d, i) => (
                      <motion.button
                        key={d.id}
                        onClick={() => setVerifyToken(d.downloadToken)}
                        whileHover={{ x: 4 }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '8px 12px', borderRadius: '10px', marginBottom: '6px',
                          border: '1px solid #E5E7EB', background: '#F9FAFB',
                          cursor: 'pointer', textAlign: 'left', transition: 'all 200ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.borderColor = '#DDD6FE'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                      >
                        <FileText size={14} style={{ color: '#7C3AED', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{d.paper?.title}</p>
                          <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#9CA3AF' }}>{d.downloadToken?.slice(0, 16)}...</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </Card>

              {/* Result Panel */}
              <div>
                <AnimatePresence mode="wait">
                  {verifyResult && (
                    <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Card style={{ border: '2px solid #BBF7D0', background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldCheck size={26} style={{ color: '#16A34A' }} />
                          </div>
                          <div>
                            <p style={{ fontSize: '16px', fontWeight: 800, color: '#166534' }}>✓ Document Verified</p>
                            <p style={{ fontSize: '12px', color: '#16A34A', marginTop: '2px' }}>This is an authentic watermarked copy</p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {[
                            { icon: <FileText size={16} />, label: 'Paper', value: verifyResult.paper, color: '#2563EB', bg: '#DBEAFE' },
                            { icon: <BookOpen size={16} />, label: 'Subject', value: verifyResult.subject, color: '#7C3AED', bg: '#EDE9FE' },
                            { icon: <User size={16} />, label: 'Downloaded By', value: verifyResult.downloadedBy, color: '#16A34A', bg: '#DCFCE7' },
                            { icon: <Shield size={16} />, label: 'Email', value: verifyResult.email, color: '#D97706', bg: '#FEF3C7' },
                            { icon: <Clock size={16} />, label: 'Downloaded At', value: new Date(verifyResult.downloadedAt).toLocaleString(), color: '#6B7280', bg: '#F3F4F6' },
                            { icon: <MapPin size={16} />, label: 'IP Address', value: verifyResult.ipAddress || 'Not recorded', color: '#EF4444', bg: '#FEE2E2' },
                          ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: '#fff', border: '1px solid #E5E7EB' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                                {item.icon}
                              </div>
                              <div>
                                <p style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</p>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{item.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </motion.div>
                  )}

                  {verifyError && (
                    <motion.div key="error" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Card style={{ border: '2px solid #FECACA', background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <XCircle size={26} style={{ color: '#DC2626' }} />
                          </div>
                          <div>
                            <p style={{ fontSize: '16px', fontWeight: 800, color: '#991B1B' }}>✗ Verification Failed</p>
                            <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '2px' }}>{verifyError}</p>
                          </div>
                        </div>
                        <p style={{ fontSize: '13px', color: '#7F1D1D' }}>
                          The token you entered could not be found in the system. Please check the token and try again.
                        </p>
                      </Card>
                    </motion.div>
                  )}

                  {!verifyResult && !verifyError && (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Card style={{ textAlign: 'center', padding: '48px', background: '#FAFAFA', border: '2px dashed #E5E7EB' }}>
                        <Shield size={48} style={{ color: '#D1D5DB', margin: '0 auto 16px' }} />
                        <p style={{ fontSize: '15px', fontWeight: 700, color: '#6B7280' }}>Enter a token to verify</p>
                        <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px', lineHeight: 1.6 }}>
                          The watermark token is printed at the bottom of every downloaded exam paper
                        </p>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      {/* ── Today's Duties ───────────────────────────────────── */}
{activeTab === 'duties' && (
  <motion.div key="duties" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Today's Duties</h2>
      <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>

    {/* Summary Cards */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
      <StatCard icon={<CheckCircle2 size={20} />} label="Ready to Download" value={papers.filter(p => p.status === 'released' && !downloadedPapers.has(p.id)).length} bg="#DCFCE7" color="#16A34A" sublabel="Action required" />
      <StatCard icon={<Download size={20} />} label="Already Downloaded" value={myDownloads.length} bg="#DBEAFE" color="#2563EB" sublabel="Completed" />
      <StatCard icon={<Clock size={20} />} label="Releasing Today" value={papers.filter(p => p.releaseAt && !p.isReleased && new Date(p.releaseAt).toDateString() === new Date().toDateString()).length} bg="#FEF3C7" color="#D97706" sublabel="Coming up" />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Action Required */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={16} style={{ color: '#EF4444' }} />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Action Required</p>
        </div>

        {papers.filter(p => p.status === 'released' && !downloadedPapers.has(p.id)).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
            <CheckCircle2 size={32} style={{ margin: '0 auto 8px', color: '#22C55E' }} />
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>All done!</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>You've downloaded all available papers</p>
          </div>
        ) : (
          papers.filter(p => p.status === 'released' && !downloadedPapers.has(p.id)).map((paper, i) => (
            <motion.div key={paper.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: '8px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{paper.title}</p>
                  <p style={{ fontSize: '11px', color: '#6B7280' }}>{paper.subject} — Download required</p>
                </div>
              </div>
              <motion.button
                onClick={() => handleDownload(paper.id, paper.subject, paper.title)}
                whileHover={{ y: -2, boxShadow: '0 6px 16px rgba(37,99,235,0.3)' }}
                whileTap={{ scale: 0.97 }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'linear-gradient(90deg, #2563EB, #4F46E5)', color: '#fff' }}
              >
                <Download size={13} /> Download
              </motion.button>
            </motion.div>
          ))
        )}
      </Card>

      {/* Completed + Upcoming */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Completed */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Completed</p>
          </div>
          {papers.filter(p => downloadedPapers.has(p.id)).length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '16px' }}>No downloads yet today</p>
          ) : (
            papers.filter(p => downloadedPapers.has(p.id)).map((paper, i) => (
              <div key={paper.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < papers.filter(p => downloadedPapers.has(p.id)).length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <CheckCircle2 size={16} style={{ color: '#22C55E', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{paper.title}</p>
                  <p style={{ fontSize: '11px', color: '#6B7280' }}>{paper.subject}</p>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Releasing Today */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} style={{ color: '#D97706' }} />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Releasing Today</p>
          </div>
          {papers.filter(p => p.releaseAt && !p.isReleased && new Date(p.releaseAt).toDateString() === new Date().toDateString()).length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '16px' }}>No papers releasing today</p>
          ) : (
            papers.filter(p => p.releaseAt && !p.isReleased && new Date(p.releaseAt).toDateString() === new Date().toDateString()).map((paper, i) => (
              <div key={paper.id} style={{ padding: '10px 12px', borderRadius: '10px', background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: '8px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{paper.title}</p>
                <CountdownTimer releaseAt={paper.releaseAt} onReleased={fetchAssignedPapers} />
              </div>
            ))
          )}
        </Card>
      </div>
    </div>

    {/* Daily briefing */}
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
      style={{ marginTop: '20px', padding: '20px', borderRadius: '16px', background: 'linear-gradient(135deg, #1e3a8a, #2563EB)', color: '#fff' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <ShieldCheck size={24} style={{ color: '#93C5FD', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '14px', fontWeight: 700 }}>Security Reminder</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '4px', lineHeight: 1.6 }}>
            Every paper you download is watermarked with your identity. Do not share downloaded papers. Report any suspicious activity immediately.
          </p>
        </div>
      </div>
    </motion.div>
  </motion.div>
)}
      </AnimatePresence>
    </Layout>
  );
}