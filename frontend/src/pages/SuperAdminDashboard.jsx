import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getUsers, createUser, toggleUserActive,
  getAuditLogs, verifyHashChain,
  getAnomalies, getAnomalyStats, logout
} from '../services/api';
import AuditLogTable from '../components/AuditLogTable';
import AnomalyCard from '../components/AnomalyCard';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState(null);
  const [hashResult, setHashResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'invigilator' });
  const [message, setMessage] = useState('');

  useEffect(() => { fetchUsers(); fetchStats(); }, []);
  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'anomalies') fetchAnomalies();
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await getAuditLogs();
      setAuditLogs(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchAnomalies = async () => {
    try {
      const res = await getAnomalies();
      setAnomalies(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchStats = async () => {
    try {
      const res = await getAnomalyStats();
      setStats(res.data);
    } catch (err) { console.error(err); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser(newUser);
      setMessage('User created successfully!');
      setNewUser({ name: '', email: '', password: '', role: 'invigilator' });
      fetchUsers();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await toggleUserActive(id);
      fetchUsers();
    } catch (err) { console.error(err); }
  };

  const handleVerifyChain = async () => {
    setLoading(true);
    try {
      const res = await verifyHashChain();
      setHashResult(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await logout();
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Super Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome, {user.name}</p>
        </div>
        <button onClick={handleLogout} className="text-red-600 hover:text-red-800 text-sm font-medium">
          Logout
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 p-6">
          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-2xl font-bold text-gray-800">{users.length}</p>
            <p className="text-sm text-gray-500">Total Users</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.unresolved}</p>
            <p className="text-sm text-gray-500">Open Anomalies</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-2xl font-bold text-red-600">{stats.highRisk}</p>
            <p className="text-sm text-gray-500">High Risk</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
            <p className="text-sm text-gray-500">Resolved</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-6">
        <div className="flex gap-2 mb-4">
          {['users', 'audit', 'anomalies'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab === 'users' ? 'User Management' : tab === 'audit' ? 'Audit Logs' : 'Anomalies'}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Create User Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Create New User</h2>
              {message && (
                <div className={`px-4 py-2 rounded mb-4 text-sm ${
                  message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {message}
                </div>
              )}
              <form onSubmit={handleCreateUser}>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full border rounded px-3 py-2 mb-3 text-sm"
                  required
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full border rounded px-3 py-2 mb-3 text-sm"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full border rounded px-3 py-2 mb-3 text-sm"
                  required
                />
                <select
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full border rounded px-3 py-2 mb-4 text-sm"
                >
                  <option value="invigilator">Invigilator</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-medium"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </form>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">All Users</h2>
              <div className="space-y-3">
                {users.map(u => (
                  <div key={u.id} className="flex justify-between items-center border-b pb-3">
                    <div>
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-gray-500 text-xs">{u.email}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${u.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {u.role !== 'super_admin' && (
                        <button
                          onClick={() => handleToggleActive(u.id)}
                          className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Audit Logs</h2>
              <button
                onClick={handleVerifyChain}
                disabled={loading}
                className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900"
              >
                {loading ? 'Verifying...' : '🔐 Verify Hash Chain'}
              </button>
            </div>
            {hashResult && (
              <div className={`px-4 py-3 rounded mb-4 text-sm ${
                hashResult.valid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {hashResult.valid ? '✅' : '❌'} {hashResult.message}
                {hashResult.brokenAt && (
                  <p className="mt-1">Broken at entry {hashResult.brokenAt.index} — Log ID: {hashResult.brokenAt.logId}</p>
                )}
              </div>
            )}
            <AuditLogTable logs={auditLogs} />
          </div>
        )}

        {/* Anomalies Tab */}
        {activeTab === 'anomalies' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Security Anomalies</h2>
            {anomalies.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No anomalies detected.</p>
            ) : (
              anomalies.map(anomaly => (
                <AnomalyCard key={anomaly.id} anomaly={anomaly} onResolved={fetchAnomalies} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}