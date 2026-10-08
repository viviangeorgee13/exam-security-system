import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Upload, FileText, X, CheckCircle2, AlertCircle, ShieldCheck, Lock, FolderOpen } from 'lucide-react';
import { bulkUploadPapers } from '../services/api';

const MAX_FILES = 20;
const MAX_SIZE = 50 * 1024 * 1024;

const card = {
  background: '#fff', borderRadius: '16px', padding: '24px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6',
};

const inputStyle = {
  width: '100%', height: '40px', borderRadius: '10px',
  border: '1.5px solid #E5E7EB', background: '#F9FAFB',
  color: '#111827', fontSize: '13px', padding: '0 12px',
  outline: 'none', boxSizing: 'border-box',
};

const labelStyle = { fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' };
const hintStyle = { fontSize: '11px', color: '#9CA3AF', marginTop: '4px' };

function titleFromFile(name) {
  return name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BulkUploadPanel({ onUploaded }) {
  const [rows, setRows] = useState([]);
  const [examDate, setExamDate] = useState('');
  const [releaseAt, setReleaseAt] = useState('');
  const [sharedSubject, setSharedSubject] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState(null);
  const inputRef = useRef(null);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    const pdfs = incoming.filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    const notPdf = incoming.length - pdfs.length;
    const tooBig = pdfs.filter(f => f.size > MAX_SIZE).length;
    const accepted = pdfs.filter(f => f.size <= MAX_SIZE);

    if (notPdf) toast.error(`${notPdf} file(s) skipped - only PDF files are allowed`);
    if (tooBig) toast.error(`${tooBig} file(s) skipped - each file must be under 50 MB`);

    const seen = new Set(rows.map(r => r.key));
    const toAdd = [];
    let overflow = 0;
    for (const f of accepted) {
      const key = `${f.name}-${f.size}-${f.lastModified}`;
      if (seen.has(key)) continue;
      if (rows.length + toAdd.length >= MAX_FILES) { overflow += 1; continue; }
      seen.add(key);
      toAdd.push({ key, file: f, title: titleFromFile(f.name), subject: '', status: 'ready', message: '' });
    }
    if (overflow) toast.error(`Maximum ${MAX_FILES} files per batch - ${overflow} not added`);
    if (toAdd.length) {
      setSummary(null);
      setRows(prev => [...prev, ...toAdd]);
    }
  };

  const updateRow = (key, field, value) =>
    setRows(prev => prev.map(r => (r.key === key
      ? { ...r, [field]: value, ...(r.status === 'error' ? { status: 'ready', message: '' } : {}) }
      : r)));

  const removeRow = (key) => setRows(prev => prev.filter(r => r.key !== key));

  const reset = () => {
    setRows([]);
    setSummary(null);
    setProgress(0);
  };

  const pending = rows.filter(r => r.status !== 'done');
  const doneCount = rows.length - pending.length;

  const applyResults = (data, sentKeys) => {
    setRows(prev => prev.map(r => {
      const idx = sentKeys.indexOf(r.key);
      if (idx === -1) return r;
      const result = data.results?.[idx];
      if (!result) return r;
      return result.success
        ? { ...r, status: 'done', message: `Encrypted - SHA-256 ${result.fileHash}...` }
        : { ...r, status: 'error', message: result.error };
    }));
    setSummary(data);
    if (data.succeeded > 0) {
      toast.success(`${data.succeeded} of ${data.total} papers uploaded and encrypted`);
      if (onUploaded) onUploaded();
    }
    if (data.failed > 0) toast.error(`${data.failed} paper(s) could not be uploaded - see the list`);
  };

  const handleUpload = async () => {
    if (pending.length === 0) { toast.error('Add at least one PDF to upload'); return; }
    if (!examDate) { toast.error('Choose an exam date for this batch'); return; }
    const incomplete = pending.filter(r => !r.title.trim() || !(r.subject.trim() || sharedSubject.trim()));
    if (incomplete.length) { toast.error(`${incomplete.length} paper(s) still need a title and subject`); return; }

    const sentKeys = pending.map(r => r.key);
    const formData = new FormData();
    pending.forEach(r => formData.append('files', r.file));
    formData.append('meta', JSON.stringify(pending.map(r => ({
      title: r.title.trim(),
      subject: r.subject.trim() || sharedSubject.trim(),
    }))));
    formData.append('examDate', examDate);
    if (releaseAt) formData.append('releaseAt', releaseAt);

    setUploading(true);
    setProgress(0);
    try {
      const res = await bulkUploadPapers(formData, {
        onUploadProgress: e => setProgress(Math.round((e.loaded * 100) / (e.total || e.loaded || 1))),
      });
      applyResults(res.data, sentKeys);
    } catch (err) {
      if (err.response?.data?.results) applyResults(err.response.data, sentKeys);
      else toast.error(err.response?.data?.error || 'Bulk upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>Bulk Paper Upload</h2>
        <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
          Upload up to {MAX_FILES} PDFs at once. Every paper is encrypted separately with its own AES-256 key.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
        <div style={card}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '20px' }}>Batch Settings</p>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Exam Date</label>
            <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} disabled={uploading} style={inputStyle} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Release Time <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
            <input type="datetime-local" value={releaseAt} onChange={e => setReleaseAt(e.target.value)} disabled={uploading} style={inputStyle} />
            <p style={hintStyle}>Applies to every paper in this batch</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Subject for all <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
            <input type="text" value={sharedSubject} onChange={e => setSharedSubject(e.target.value)} disabled={uploading} placeholder="e.g. Computer Engineering" style={inputStyle} />
            <p style={hintStyle}>Used for any paper whose subject is left blank</p>
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginBottom: '10px' }}>Applied to every file</p>
            {[
              'Contents checked as a real PDF, not just the file name',
              'Encrypted with its own unique AES-256 key',
              'Original file never written to disk',
              'Each upload recorded in the hash-chained audit log',
            ].map(text => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                <ShieldCheck size={13} style={{ color: '#16A34A', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '11px', color: '#4B5563', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            onClick={() => { if (!uploading && inputRef.current) inputRef.current.click(); }}
            onDragOver={e => { e.preventDefault(); if (!uploading) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); if (!uploading) addFiles(e.dataTransfer.files); }}
            style={{
              ...card,
              border: `2px dashed ${dragging ? '#2563EB' : '#BFDBFE'}`,
              background: dragging ? '#EFF6FF' : 'linear-gradient(135deg, #F8FAFF, #EEF4FF)',
              textAlign: 'center', padding: '32px', cursor: uploading ? 'not-allowed' : 'pointer',
              marginBottom: '16px', transition: 'all 200ms ease',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              style={{ display: 'none' }}
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
            />
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Upload size={26} style={{ color: '#2563EB' }} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Drag and drop PDFs here</p>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>or click to browse - up to {MAX_FILES} files, 50 MB each</p>
          </div>

          {rows.length > 0 && (
            <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                  {rows.length} file{rows.length !== 1 ? 's' : ''} selected
                  {doneCount > 0 && <span style={{ fontSize: '12px', fontWeight: 600, color: '#16A34A', marginLeft: '8px' }}>{doneCount} uploaded</span>}
                </p>
                <button onClick={reset} disabled={uploading} style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', background: 'none', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                  {doneCount === rows.length ? 'Start new batch' : 'Clear all'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1.2fr 1.5fr 28px', gap: '12px', padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                {['File', 'Title', 'Subject', 'Status', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>

              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {rows.map((r, i) => {
                  const locked = uploading || r.status === 'done';
                  const rowBg = r.status === 'done' ? '#F0FDF4' : r.status === 'error' ? '#FEF2F2' : (i % 2 === 0 ? '#fff' : '#FAFBFC');
                  return (
                    <motion.div
                      key={r.key}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1.2fr 1.5fr 28px', gap: '12px', padding: '10px 20px', alignItems: 'center', borderBottom: '1px solid #F8FAFC', background: rowBg }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <FileText size={16} style={{ color: '#2563EB', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.file.name}</p>
                          <p style={{ fontSize: '10px', color: '#9CA3AF' }}>{formatSize(r.file.size)}</p>
                        </div>
                      </div>
                      <input value={r.title} onChange={e => updateRow(r.key, 'title', e.target.value)} disabled={locked} placeholder="Paper title" style={{ ...inputStyle, height: '34px' }} />
                      <input value={r.subject} onChange={e => updateRow(r.key, 'subject', e.target.value)} disabled={locked} placeholder={sharedSubject || 'Subject'} style={{ ...inputStyle, height: '34px' }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', minWidth: 0 }}>
                        {r.status === 'done' && <CheckCircle2 size={14} style={{ color: '#16A34A', flexShrink: 0, marginTop: '1px' }} />}
                        {r.status === 'error' && <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0, marginTop: '1px' }} />}
                        {r.status === 'ready' && <Lock size={14} style={{ color: '#9CA3AF', flexShrink: 0, marginTop: '1px' }} />}
                        <span style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word', color: r.status === 'done' ? '#166534' : r.status === 'error' ? '#991B1B' : '#6B7280' }}>
                          {r.status === 'ready' ? (uploading ? 'Uploading...' : 'Ready to encrypt') : r.message}
                        </span>
                      </div>
                      <button onClick={() => removeRow(r.key)} disabled={locked} aria-label="Remove file" style={{ background: 'none', border: 'none', cursor: locked ? 'not-allowed' : 'pointer', color: '#9CA3AF', display: 'flex', padding: 0, opacity: locked ? 0.3 : 1 }}>
                        <X size={16} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {rows.length > 0 && pending.length > 0 && (
            <div style={card}>
              {uploading && (
                <div style={{ marginBottom: '14px' }}>
                  <p style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500, marginBottom: '6px' }}>
                    {progress < 100 ? `Uploading files... ${progress}%` : 'Encrypting each paper with its own key...'}
                  </p>
                  <div style={{ height: '8px', borderRadius: '4px', background: '#F3F4F6', overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #2563EB, #4F46E5)' }} />
                  </div>
                </div>
              )}
              <motion.button
                onClick={handleUpload}
                disabled={uploading}
                whileHover={!uploading ? { y: -2, boxShadow: '0 10px 24px rgba(37,99,235,0.3)' } : {}}
                whileTap={!uploading ? { scale: 0.98 } : {}}
                style={{ width: '100%', height: '48px', borderRadius: '12px', border: 'none', background: uploading ? 'linear-gradient(90deg, #93C5FD, #A5B4FC)' : 'linear-gradient(90deg, #2563EB, #4F46E5)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {uploading ? 'Processing...' : <><Upload size={16} /> Encrypt and Upload {pending.length} Paper{pending.length !== 1 ? 's' : ''}</>}
              </motion.button>
            </div>
          )}

          {summary && !uploading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ ...card, marginTop: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: summary.failed === 0 ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${summary.failed === 0 ? '#BBF7D0' : '#FDE68A'}` }}
            >
              {summary.failed === 0
                ? <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                : <AlertCircle size={20} style={{ color: '#D97706', flexShrink: 0 }} />}
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                  {summary.succeeded} of {summary.total} papers uploaded and encrypted
                </p>
                <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                  Batch {String(summary.batchId).slice(0, 8)} recorded in the audit log
                  {summary.failed > 0 ? ' - fix the highlighted files and upload again' : ''}
                </p>
              </div>
            </motion.div>
          )}

          {rows.length === 0 && (
            <div style={{ ...card, textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
              <FolderOpen size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ fontSize: '13px' }}>No files selected yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}