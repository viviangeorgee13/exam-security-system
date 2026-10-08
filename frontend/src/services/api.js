 import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
});

// Automatically attach token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatically handle token expiry
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED') {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const res = await axios.post('http://localhost:5000/api/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return axios(error.config);
      } catch (err) {
        localStorage.clear();
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email, password) => API.post('/auth/login', { email, password });
export const logout = () => API.post('/auth/logout');
export const getMe = () => API.get('/auth/me');

// Users
export const getUsers = () => API.get('/users');
export const createUser = (data) => API.post('/users', data);
export const toggleUserActive = (id) => API.patch(`/users/${id}/toggle-active`);

// Papers
export const getPapers = () => API.get('/papers');
export const uploadPaper = (formData) => API.post('/papers/upload', formData);
export const deletePaper = (id) => API.delete(`/papers/${id}`);
export const schedulePaper = (id, releaseAt) => API.patch(`/papers/${id}/schedule`, { releaseAt });
export const getPaperStatus = (id) => API.get(`/papers/${id}/status`);
export const downloadPaper = (id) => API.get(`/papers/${id}/download`, { responseType: 'blob' });

// Permissions
export const getPermissions = (paperId) => API.get(`/papers/${paperId}/permissions`);
export const grantPermission = (paperId, userId) => API.post(`/papers/${paperId}/permissions`, { userId });
export const revokePermission = (paperId, userId) => API.delete(`/papers/${paperId}/permissions/${userId}`);

// Audit
export const getAuditLogs = () => API.get('/audit');
export const verifyHashChain = () => API.get('/audit/verify');

// Anomalies
export const getAnomalies = () => API.get('/anomalies');
export const resolveAnomaly = (id) => API.patch(`/anomalies/${id}/resolve`);
export const getAnomalyStats = () => API.get('/anomalies/stats');
export const getDownloads = () => API.get('/downloads');
export const getMyDownloads = () => API.get('/downloads/my');
export const verifyDownloadToken = (token) => API.get(`/downloads/verify/${token}`);
// Download OTP
export const requestDownloadOtp = (paperId) => API.post(`/papers/${paperId}/request-download-otp`);
export const verifyDownloadOtp = (paperId, otp) => API.post(`/papers/${paperId}/verify-download-otp`, { otp });
export const downloadPaperWithAuth = (paperId, auth) => API.get(`/papers/${paperId}/download?auth=${auth}`, { responseType: 'blob' });

// Failed download attempts
export const getFailedAttempts = () => API.get('/downloads/failed-attempts');
