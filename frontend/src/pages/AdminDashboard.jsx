import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPapers, uploadPaper, deletePaper, schedulePaper,
  getPermissions, grantPermission, revokePermission,
  logout
} from '../services/api';
import axios from 'axios';
import CountdownTimer from '../components/CountdownTimer';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [activeTab, setActiveTab] = useState('papers');
  const [papers, setPapers] = useState([]);
  const [invigilators, setInvigilators] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    title: '', subject: '', examDate: '', releaseAt: '', file: null
  });
  const [scheduleForm, setScheduleForm] = useState({ paperId: '', releaseAt: '' });

  useEffect(() => { fetchPapers(); fetchInvigilators(); }, []);

  const fetchPapers = async () => {
    try {
      const res = await getPapers();
      setPapers(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchInvigilators = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/users/invigilators', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setInvigilators(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchPermissions = async (paperId) => {
    try {
      const res = await getPermissions(paperId);
      setPermissions(res.data.permissions);
    } catch (err) { console.error(err); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('title', uploadForm.title);
      formData.append('subject', uploadForm.subject);
      formData.append('examDate', uploadForm.examDate);
      if (uploadForm.releaseAt) formData.append('releaseAt', uploadForm.releaseAt);
      formData.append('file', uploadForm.file);
      await uploadPaper(formData);
      setMessage('Paper uploaded and encrypted successfully!');
      setUploadForm({ title: '', subject: '', examDate: '', releaseAt: '', file: null });
      fetchPapers();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Upload failed');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this paper?')) return;
    try {
      await deletePaper(id);
      fetchPapers();
    } catch (err) { console.error(err); }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    try {
      await schedulePaper(scheduleForm.paperId, scheduleForm.releaseAt);
      setMessage('Release time updated successfully!');
      fetchPapers();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to schedule');
    }
  };

  const handleSelectPaper = (paper) => {
    setSelectedPaper(paper);
    fetchPermissions(paper.id);
  };

  const handleGrantPermission = async (userId) => {
    try {
      await grantPermission(selectedPaper.id, userId);
      fetchPermissions(selectedPaper.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to grant permission');
    }
  };

  const handleRevokePermission = async (userId) => {
    try {
      await revokePermission(selectedPaper.id, userId);
      fetchPermissions(selectedPaper.id);
    } catch (err) { console.error(err); }
  };

  const handleLogout = async () => {
    await logout();
    localStorage.clear();
    navigate('/');
  };

  const getStatusBadge = (paper) => {
    if (paper.isReleased) return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Released</span>;
    if (paper.releaseAt) return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">Scheduled</span>;
    return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">Not Scheduled</span>;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome, {user.name}</p>
        </div>
        <button onClick={handleLogout} className="text-red-600 hover:text-red-800 text-sm font-medium">
          Logout
        </button>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {['papers', 'upload', 'schedule', 'permissions'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded font-medium text-sm capitalize ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab === 'papers' ? 'All Papers' :
               tab === 'upload' ? 'Upload Paper' :
               tab === 'schedule' ? 'Schedule' : 'Permissions'}
            </button>
          ))}
        </div>

        {message && (
          <div className={`px-4 py-2 rounded mb-4 text-sm ${
            message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {/* Papers Tab */}
        {activeTab === 'papers' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">All Papers</h2>
            {papers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No papers uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {papers.map(paper => (
                  <div key={paper.id} className="border rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{paper.title}</p>
                      <p className="text-sm text-gray-500">{paper.subject} — Exam: {new Date(paper.examDate).toLocaleDateString()}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(paper)}
                        {paper.releaseAt && !paper.isReleased && (
                          <CountdownTimer releaseAt={paper.releaseAt} onReleased={fetchPapers} />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(paper.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg shadow p-6 max-w-lg">
            <h2 className="text-lg font-semibold mb-4">Upload New Paper</h2>
            <form onSubmit={handleUpload}>
              <input
                type="text"
                placeholder="Paper Title"
                value={uploadForm.title}
                onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                className="w-full border rounded px-3 py-2 mb-3 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Subject"
                value={uploadForm.subject}
                onChange={e => setUploadForm({ ...uploadForm, subject: e.target.value })}
                className="w-full border rounded px-3 py-2 mb-3 text-sm"
                required
              />
              <div className="mb-3">
                <label className="text-sm text-gray-600 mb-1 block">Exam Date</label>
                <input
                  type="date"
                  value={uploadForm.examDate}
                  onChange={e => setUploadForm({ ...uploadForm, examDate: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="text-sm text-gray-600 mb-1 block">Release Time (optional)</label>
                <input
                  type="datetime-local"
                  value={uploadForm.releaseAt}
                  onChange={e => setUploadForm({ ...uploadForm, releaseAt: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-1 block">PDF File</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={e => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                  className="w-full text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-medium"
              >
                {loading ? 'Uploading...' : 'Upload & Encrypt'}
              </button>
            </form>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-lg shadow p-6 max-w-lg">
            <h2 className="text-lg font-semibold mb-4">Schedule Paper Release</h2>
            <form onSubmit={handleSchedule}>
              <div className="mb-3">
                <label className="text-sm text-gray-600 mb-1 block">Select Paper</label>
                <select
                  value={scheduleForm.paperId}
                  onChange={e => setScheduleForm({ ...scheduleForm, paperId: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                >
                  <option value="">-- Select a paper --</option>
                  {papers.filter(p => !p.isReleased).map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-1 block">Release Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduleForm.releaseAt}
                  onChange={e => setScheduleForm({ ...scheduleForm, releaseAt: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-medium"
              >
                Set Release Time
              </button>
            </form>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Select Paper</h2>
              <div className="space-y-2">
                {papers.map(paper => (
                  <div
                    key={paper.id}
                    onClick={() => handleSelectPaper(paper)}
                    className={`border rounded p-3 cursor-pointer hover:bg-gray-50 ${
                      selectedPaper?.id === paper.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <p className="font-medium text-sm">{paper.title}</p>
                    <p className="text-xs text-gray-500">{paper.subject}</p>
                  </div>
                ))}
              </div>
            </div>

            {selectedPaper && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Permissions for "{selectedPaper.title}"
                </h2>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Assign Invigilator:</h3>
                {invigilators.length === 0 ? (
                  <p className="text-gray-500 text-sm">No invigilators found.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {invigilators.map(inv => {
                      const hasPermission = permissions.find(p => p.invigilator.id === inv.id && p.isActive);
                      return (
                        <div key={inv.id} className="flex justify-between items-center border rounded p-2">
                          <div>
                            <p className="text-sm font-medium">{inv.name}</p>
                            <p className="text-xs text-gray-500">{inv.email}</p>
                          </div>
                          {hasPermission ? (
                            <button
                              onClick={() => handleRevokePermission(inv.id)}
                              className="text-xs text-red-600 border border-red-300 rounded px-2 py-1 hover:bg-red-50"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => handleGrantPermission(inv.id)}
                              className="text-xs text-green-600 border border-green-300 rounded px-2 py-1 hover:bg-green-50"
                            >
                              Grant
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}