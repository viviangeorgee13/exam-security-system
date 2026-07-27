import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { login } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password);
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success('Login successful!');
      const role = res.data.user.role;
      setTimeout(() => {
        if (role === 'super_admin') navigate('/super-admin');
        else if (role === 'admin') navigate('/admin');
        else if (role === 'invigilator') navigate('/invigilator');
      }, 500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Secure encrypted paper storage',
    'Scheduled time-locked paper release',
    'Invigilator-based access control',
    'Role-based administrator management',
    'Tamper-proof audit logging',
    'Forensic watermark on every download',
  ];

  const inputStyle = {
    height: '54px',
    borderRadius: '12px',
    border: '1.5px solid #E5E7EB',
    background: '#F9FAFB',
    color: '#111827',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
    transition: 'all 200ms ease',
    paddingLeft: '44px',
    paddingRight: '16px',
    boxSizing: 'border-box',
  };

  return (
    <div className="min-h-screen flex" style={{
      background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF4FF 100%)'
    }}>
      <Toaster position="top-right" richColors />

      {/* Left Panel — 55% */}
      <div
        className="hidden lg:flex lg:w-[55%] relative items-center justify-center p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 55%, #4F46E5 100%)' }}
      >
        {/* Background circles — subtle slow opacity pulse */}
        {[
          { top: '-80px', left: '-80px', size: '400px', delay: 0 },
          { bottom: '-100px', right: '-100px', size: '500px', delay: 1.5 },
          { top: '40%', right: '-60px', size: '250px', delay: 3 },
        ].map((circle, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.04, 0.08, 0.04] }}
            transition={{ duration: 8, repeat: Infinity, delay: circle.delay, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: circle.top,
              left: circle.left,
              bottom: circle.bottom,
              right: circle.right,
              width: circle.size,
              height: circle.size,
              borderRadius: '50%',
              background: 'rgba(255,255,255,1)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Dotted grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="text-white text-center relative z-10 max-w-md"
        >
          {/* Floating Shield */}
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="flex justify-center mb-8"
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: '112px',
                height: '112px',
                borderRadius: '28px',
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.25)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2), 0 0 0 12px rgba(255,255,255,0.04)',
              }}
            >
              <ShieldCheck size={58} className="text-white" />
            </div>
          </motion.div>

          {/* Branding */}
          <p className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: 'rgba(255,255,255,0.55)' }}>
            Enterprise Edition
          </p>
          <h1 className="text-4xl font-bold mb-3 leading-tight">
            Exam Security System
          </h1>
          <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,0.72)' }}>
            Secure Paper Distribution Platform
          </p>

          {/* Feature List */}
          <div className="space-y-3 text-left">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
                className="flex items-center gap-3"
              >
                <CheckCircle2
                  size={17}
                  style={{ color: '#86EFAC', flexShrink: 0, marginTop: '1px' }}
                />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.88)', lineHeight: 1.5 }}>
                  {feature}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Divider + copyright */}
          <div className="mt-10 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              © 2026 Exam Security System
            </span>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>
        </motion.div>
      </div>

      {/* Right Panel — 45% */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, #2563EB, #4F46E5)' }}
            >
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>
              Exam Security System
            </h1>
          </div>

          {/* Card */}
          <div
            style={{
              borderRadius: '24px',
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 64px rgba(37,99,235,0.10), 0 4px 24px rgba(0,0,0,0.06)',
              border: '1px solid rgba(229,231,235,0.9)',
            }}
          >
            {/* Top accent */}
            <div style={{
              height: '4px',
              background: 'linear-gradient(90deg, #2563EB, #4F46E5)',
            }} />

            <div style={{ padding: '36px 36px 32px' }}>
              {/* Heading */}
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
                  Welcome Back
                </h2>
                <p style={{ fontSize: '13.5px', color: '#6B7280', lineHeight: 1.5 }}>
                  Sign in to continue to the Exam Security Platform
                </p>
              </div>

              <form onSubmit={handleLogin}>
                {/* Email */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{
                      position: 'absolute', left: '14px',
                      top: '50%', transform: 'translateY(-50%)',
                      color: '#9CA3AF', pointerEvents: 'none',
                    }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      style={inputStyle}
                      onFocus={e => {
                        e.target.style.borderColor = '#2563EB';
                        e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.10)';
                        e.target.style.background = '#ffffff';
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = '#E5E7EB';
                        e.target.style.boxShadow = 'none';
                        e.target.style.background = '#F9FAFB';
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{
                      position: 'absolute', left: '14px',
                      top: '50%', transform: 'translateY(-50%)',
                      color: '#9CA3AF', pointerEvents: 'none',
                    }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      style={{ ...inputStyle, paddingRight: '44px' }}
                      onFocus={e => {
                        e.target.style.borderColor = '#2563EB';
                        e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.10)';
                        e.target.style.background = '#ffffff';
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = '#E5E7EB';
                        e.target.style.boxShadow = 'none';
                        e.target.style.background = '#F9FAFB';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '14px',
                        top: '50%', transform: 'translateY(-50%)',
                        color: '#9CA3AF', background: 'none',
                        border: 'none', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? {
                    y: -2,
                    boxShadow: '0 12px 28px rgba(37,99,235,0.35)',
                  } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  style={{
                    width: '100%',
                    height: '52px',
                    borderRadius: '12px',
                    border: 'none',
                    background: loading
                      ? 'linear-gradient(90deg, #93C5FD, #A5B4FC)'
                      : 'linear-gradient(90deg, #2563EB, #4F46E5)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.22)',
                    transition: 'all 200ms ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{
                        width: '16px', height: '16px',
                        border: '2px solid rgba(255,255,255,0.4)',
                        borderTopColor: '#ffffff',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                      }} />
                      Signing in...
                    </>
                  ) : 'Sign In'}
                </motion.button>
              </form>

              {/* Security Badge */}
              <div style={{
                marginTop: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                borderRadius: '12px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
              }}>
                <ShieldCheck size={17} style={{ color: '#22C55E', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: '1px' }}>
                    Protected by AES-256 Encryption
                  </p>
                  <p style={{ fontSize: '11px', color: '#4ADE80' }}>
                    All connections are encrypted and monitored
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '11px', color: '#9CA3AF', opacity: 0.8, lineHeight: 1.6 }}>
              © 2026 Exam Security System
            </p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', opacity: 0.6 }}>
              Enterprise Edition • Version 1.0
            </p>
          </div>
        </motion.div>
      </div>

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}