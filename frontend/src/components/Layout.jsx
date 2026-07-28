import AIAssistant from './AIAssistant';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import {
  Shield, LayoutDashboard, FileText, Upload,
  Calendar, Users, Settings, LogOut, Bell,
  Menu, X, ChevronRight
} from 'lucide-react';
import { logout } from '../services/api';

export default function Layout({ children, navItems, title, subtitle }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {}
    localStorage.clear();
    toast.success('Logged out successfully');
    setTimeout(() => navigate('/'), 500);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const getRoleColor = (role) => {
    if (role === 'super_admin') return { bg: '#EDE9FE', text: '#7C3AED' };
    if (role === 'admin') return { bg: '#DBEAFE', text: '#2563EB' };
    return { bg: '#DCFCE7', text: '#16A34A' };
  };

  const getRoleLabel = (role) => {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Administrator';
    return 'Invigilator';
  };

  const roleColor = getRoleColor(user.role);

return (
     <>
    <div className="min-h-screen flex" style={{ background: '#F5F7FB', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Toaster position="top-right" richColors />

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: sidebarOpen ? '260px' : '72px' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col flex-shrink-0 relative"
        style={{
          background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 50%, #2563EB 100%)',
          boxShadow: '4px 0 24px rgba(37,99,235,0.15)',
          zIndex: 40,
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
              background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
            }}>
              <Shield size={20} className="text-white" />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                    Exam Security
                  </p>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
                    ENTERPRISE
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ padding: '16px 10px', flex: 1 }}>
          {navItems.map((item) => {
            const isActive = item.active;
            return (
              <motion.button
                key={item.label}
                onClick={item.onClick}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: '12px', padding: '10px 12px', borderRadius: '10px',
                  marginBottom: '4px', border: 'none', cursor: 'pointer',
                  background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                  transition: 'all 200ms ease',
                  textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ fontSize: '13.5px', fontWeight: isActive ? 600 : 400 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && sidebarOpen && (
                  <motion.div
                    layoutId="activeIndicator"
                    style={{ marginLeft: 'auto' }}
                  >
                    <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div style={{ padding: '16px 10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.08)',
          }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
              background: 'linear-gradient(135deg, #60A5FA, #818CF8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: '#fff',
            }}>
              {getInitials(user.name)}
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.name}
                  </p>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getRoleLabel(user.role)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Logout */}
          <motion.button
            onClick={handleLogout}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: '12px', padding: '10px 12px', borderRadius: '10px',
              marginTop: '4px', border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.55)',
              transition: 'all 200ms ease', textAlign: 'left',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
              e.currentTarget.style.color = '#FCA5A5';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
            }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ fontSize: '13.5px' }}
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'absolute', top: '24px', right: '-12px',
            width: '24px', height: '24px', borderRadius: '50%',
            background: '#fff', border: '2px solid #E5E7EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 50,
          }}
        >
          <motion.div animate={{ rotate: sidebarOpen ? 0 : 180 }} transition={{ duration: 0.3 }}>
            <ChevronRight size={12} style={{ color: '#6B7280' }} />
          </motion.div>
        </button>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #E5E7EB',
          padding: '0 32px', height: '64px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '1px' }}>
              {getGreeting()},
            </p>
            <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
              {user.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '4px 10px',
              borderRadius: '20px', background: roleColor.bg, color: roleColor.text,
            }}>
              {getRoleLabel(user.role)}
            </span>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #60A5FA, #818CF8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: '#fff',
            }}>
              {getInitials(user.name)}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ flex: 1, padding: '32px', overflowY: 'auto' }}
        >
          {children}
        </motion.div>
      </div>
    </div>
    <AIAssistant user={user} />
    </>
  );
}
