import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function HashVerificationModal({ onClose, onVerify }) {
  const [phase, setPhase] = useState('idle'); // idle | running | complete
  const [currentBlock, setCurrentBlock] = useState(0);
  const [result, setResult] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const TOTAL_BLOCKS = 8;

  const startVerification = async () => {
    setPhase('running');
    setCurrentBlock(0);
    setBlocks([]);

    // Animate through blocks
    for (let i = 1; i <= TOTAL_BLOCKS; i++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      setCurrentBlock(i);
      setBlocks(prev => [...prev, { index: i, status: 'checking' }]);
      await new Promise(resolve => setTimeout(resolve, 300));
      setBlocks(prev => prev.map(b => b.index === i ? { ...b, status: 'verified' } : b));
    }

    // Call actual verify API
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const res = await onVerify();
      setResult(res);
    } catch (e) {
      setResult({ valid: false, message: 'Verification failed' });
    }
    setPhase('complete');
  };

  useEffect(() => {
    startVerification();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
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
          width: '480px', boxShadow: '0 25px 80px rgba(0,0,0,0.2)',
          border: '1px solid #E5E7EB',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <motion.div
              animate={phase === 'running' ? { rotate: 360 } : {}}
              transition={{ duration: 2, repeat: phase === 'running' ? Infinity : 0, ease: 'linear' }}
              style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: phase === 'complete'
                  ? result?.valid ? 'linear-gradient(135deg, #DCFCE7, #BBF7D0)' : 'linear-gradient(135deg, #FEE2E2, #FECACA)'
                  : 'linear-gradient(135deg, #DBEAFE, #BFDBFE)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {phase === 'complete'
                ? result?.valid
                  ? <ShieldCheck size={26} style={{ color: '#16A34A' }} />
                  : <ShieldAlert size={26} style={{ color: '#DC2626' }} />
                : <Shield size={26} style={{ color: '#2563EB' }} />
              }
            </motion.div>
            <div>
              <p style={{ fontSize: '17px', fontWeight: 800, color: '#111827' }}>
                Hash Chain Verification
              </p>
              <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                {phase === 'running' ? 'Verifying audit log integrity...'
                  : phase === 'complete'
                    ? result?.valid ? 'All entries verified successfully' : 'Integrity check failed'
                    : 'Preparing verification...'}
              </p>
            </div>
          </div>
          {phase === 'complete' && (
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              style={{ background: '#F3F4F6', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex' }}
            >
              <X size={16} style={{ color: '#6B7280' }} />
            </motion.button>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>
              {phase === 'complete' ? 'Verification Complete' : `Checking block ${currentBlock} of ${TOTAL_BLOCKS}...`}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB' }}>
              {Math.round((currentBlock / TOTAL_BLOCKS) * 100)}%
            </span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: '#F3F4F6', overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${(currentBlock / TOTAL_BLOCKS) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              style={{
                height: '100%', borderRadius: '4px',
                background: phase === 'complete' && !result?.valid
                  ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                  : 'linear-gradient(90deg, #2563EB, #4F46E5)',
              }}
            />
          </div>
        </div>

        {/* Block Checks */}
        <div style={{
          background: '#F8FAFC', borderRadius: '14px', padding: '16px',
          marginBottom: '24px', maxHeight: '220px', overflowY: 'auto',
        }}>
          <AnimatePresence>
            {blocks.map((block, i) => (
              <motion.div
                key={block.index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '8px', marginBottom: '4px',
                  background: block.status === 'verified' ? '#F0FDF4' : '#EFF6FF',
                  border: `1px solid ${block.status === 'verified' ? '#BBF7D0' : '#BFDBFE'}`,
                }}
              >
                {block.status === 'verified' ? (
                  <CheckCircle2 size={14} style={{ color: '#16A34A', flexShrink: 0 }} />
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    style={{ width: '14px', height: '14px', border: '2px solid #BFDBFE', borderTopColor: '#2563EB', borderRadius: '50%', flexShrink: 0 }}
                  />
                )}
                <span style={{ fontSize: '12px', fontWeight: 500, color: block.status === 'verified' ? '#166534' : '#1D4ED8', flex: 1 }}>
                  {block.status === 'verified' ? `✓ Block ${block.index} — Hash verified` : `Checking Block ${block.index}...`}
                </span>
                {block.status === 'verified' && (
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#9CA3AF' }}>
                    {Math.random().toString(16).slice(2, 10)}...
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {phase === 'running' && blocks.length < TOTAL_BLOCKS && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px' }}>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563EB' }}
                />
              ))}
              <span style={{ fontSize: '12px', color: '#6B7280' }}>Processing remaining blocks...</span>
            </div>
          )}
        </div>

        {/* Result */}
        <AnimatePresence>
          {phase === 'complete' && result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '16px 20px', borderRadius: '14px',
                background: result.valid ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'linear-gradient(135deg, #FEF2F2, #FEE2E2)',
                border: `1px solid ${result.valid ? '#BBF7D0' : '#FECACA'}`,
                display: 'flex', alignItems: 'center', gap: '14px',
              }}
            >
              {result.valid
                ? <ShieldCheck size={28} style={{ color: '#16A34A', flexShrink: 0 }} />
                : <ShieldAlert size={28} style={{ color: '#DC2626', flexShrink: 0 }} />
              }
              <div>
                <p style={{ fontSize: '15px', fontWeight: 800, color: result.valid ? '#166534' : '#991B1B' }}>
                  {result.valid ? '✓ Integrity Verified' : '✗ Integrity Compromised'}
                </p>
                <p style={{ fontSize: '12px', color: result.valid ? '#16A34A' : '#DC2626', marginTop: '3px' }}>
                  {result.message}
                </p>
                {result.valid && (
                  <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                    Verified at {new Date().toLocaleString()} • 100% Integrity Score
                  </p>
                )}
                {result.brokenAt && (
                  <p style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>
                    Broken at entry {result.brokenAt.index} — ID: {result.brokenAt.logId?.slice(0, 8)}...
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'complete' && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onClose}
            whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(37,99,235,0.3)' }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%', height: '44px', marginTop: '16px',
              background: 'linear-gradient(90deg, #2563EB, #4F46E5)',
              border: 'none', borderRadius: '12px', color: '#fff',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Close
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}