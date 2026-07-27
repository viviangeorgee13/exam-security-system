import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { downloadPaper, logout } from '../services/api';
import CountdownTimer from '../components/CountdownTimer';

export default function InvigilatorDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [papers, setPapers] = useState([]);
  const [downloading, setDownloading] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchAssignedPapers(); }, []);

  const fetchAssignedPapers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/papers/assigned', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setPapers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async (paperId, subject) => {
    setDownloading(paperId);
    setMessage('');
    try {
      const res = await downloadPaper(paperId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam_${subject}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setMessage('Paper downloaded successfully! Check your downloads folder.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    localStorage.clear();
    navigate('/');
  };

  const getStatusColor = (status) => {
    if (status === 'released') return 'border-green-400 bg-green-50';
    if (status === 'releasing_soon') return 'border-amber-400 bg-amber-50';
    return 'border-red-300 bg-red-50';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Invigilator Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome, {user.name}</p>
        </div>
        <button onClick={handleLogout} className="text-red-600 hover:text-red-800 text-sm font-medium">
          Logout
        </button>
      </div>

      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">My Assigned Papers</h2>

        {message && (
          <div className={`px-4 py-2 rounded mb-4 text-sm ${
            message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {papers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No papers assigned to you yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 max-w-2xl">
            {papers.map(paper => (
              <div
                key={paper.id}
                className={`border-l-4 rounded-lg p-5 shadow bg-white ${getStatusColor(paper.status)}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">{paper.title}</h3>
                    <p className="text-sm text-gray-500">{paper.subject}</p>
                    {paper.examDate && (
                      <p className="text-xs text-gray-400 mt-1">
                        Exam Date: {new Date(paper.examDate).toLocaleDateString()}
                      </p>
                    )}
                    <div className="mt-2">
                      {paper.status === 'released' ? (
                        <span className="text-green-600 text-sm font-medium">✅ Available for download</span>
                      ) : paper.releaseAt ? (
                        <div className="text-sm">
                          <span className="text-gray-500">Releases in: </span>
                          <CountdownTimer
                            releaseAt={paper.releaseAt}
                            onReleased={fetchAssignedPapers}
                          />
                        </div>
                      ) : (
                        <span className="text-red-500 text-sm">🔒 Not yet scheduled</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(paper.id, paper.subject)}
                    disabled={paper.status !== 'released' || downloading === paper.id}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      paper.status === 'released'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {downloading === paper.id ? 'Downloading...' : '⬇ Download'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}