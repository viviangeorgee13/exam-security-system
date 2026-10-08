const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { prisma, logAuditEvent } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin, isAnyRole } = require('../middleware/role.middleware');
const {
  encryptPaper,
  encryptAesKey,
  saveEncryptedFile,
} = require('../services/encryption.service');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// POST /api/papers/upload — Admin only
router.post('/upload', authenticate, isAdmin, upload.single('file'), async (req, res) => {
  try {
    const { title, subject, examDate, releaseAt } = req.body;

    if (!title || !subject || !examDate) {
      return res.status(400).json({ error: 'title, subject, and examDate are required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Check the file's actual contents, not just its name or declared type
    if (!req.file.buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
      await logAuditEvent('ADMIN_ACTION', req.user.id, null, {
        action: 'UPLOAD_REJECTED', reason: 'Not a valid PDF file', fileName: req.file.originalname,
      });
      return res.status(400).json({ error: 'Not a valid PDF file' });
    }

    const paperId = uuidv4();

    const { encrypted, aesKey, iv, fileHash } = encryptPaper(req.file.buffer);
    const { encryptedAesKey, masterIv, ivHex } = encryptAesKey(aesKey, iv);
    const filePath = saveEncryptedFile(encrypted, paperId);

    const paper = await prisma.paper.create({
      data: {
        id: paperId,
        title,
        subject,
        examDate: new Date(examDate),
        uploadedBy: req.user.id,
        encryptedFilePath: filePath,
        encryptedAesKey: `${encryptedAesKey}:${masterIv}`,
        aesIv: ivHex,
        fileHash,
        releaseAt: releaseAt ? new Date(releaseAt) : null,
      },
    });

    await logAuditEvent('PAPER_UPLOADED', req.user.id, paper.id, {
      title,
      subject,
      fileHash,
    });

    res.status(201).json({
      message: 'Paper uploaded and encrypted successfully',
      paper: {
        id: paper.id,
        title: paper.title,
        subject: paper.subject,
        examDate: paper.examDate,
        isReleased: paper.isReleased,
        releaseAt: paper.releaseAt,
        createdAt: paper.createdAt,
      },
    });
  } catch (err) {
    console.error('[UPLOAD ERROR]', err);
    res.status(500).json({ error: 'Failed to upload paper' });
  }
});

// --- POST /api/papers/bulk-upload - several PDFs in one request (Admin) -------
// Each file is validated and encrypted on its own; one bad file does not stop the rest.
const bulkUpload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024, files: 20 } });

router.post('/bulk-upload', authenticate, isAdmin, (req, res, next) => {
  bulkUpload.array('files', 20)(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be under 50 MB'
      : (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') ? 'Maximum 20 files per batch'
      : 'Upload failed';
    return res.status(400).json({ error: message });
  });
}, async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: 'Select at least one PDF file' });

    let meta;
    try {
      meta = JSON.parse(req.body.meta || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid paper details' });
    }
    if (!Array.isArray(meta)) return res.status(400).json({ error: 'Invalid paper details' });

    const { examDate } = req.body;
    const releaseAt = req.body.releaseAt || null;
    if (!examDate || isNaN(new Date(examDate).getTime())) {
      return res.status(400).json({ error: 'A valid exam date is required' });
    }
    if (releaseAt && isNaN(new Date(releaseAt).getTime())) {
      return res.status(400).json({ error: 'Invalid release time' });
    }

    const batchId = uuidv4();
    const results = [];

    // Sequential on purpose: each paper gets its own AES key, and audit entries
    // must be written one at a time to keep the hash chain intact.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const title = String(meta[i]?.title || '').trim();
      const subject = String(meta[i]?.subject || '').trim();

      if (!title || !subject) {
        results.push({ fileName: file.originalname, success: false, error: 'Title and subject are required' });
        continue;
      }

      // Check the file's actual contents, not just its name or declared type
      if (!file.buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
        results.push({ fileName: file.originalname, success: false, error: 'Not a valid PDF file' });
        continue;
      }

      try {
        const paperId = uuidv4();
        const { encrypted, aesKey, iv, fileHash } = encryptPaper(file.buffer);
        const { encryptedAesKey, masterIv, ivHex } = encryptAesKey(aesKey, iv);
        const filePath = saveEncryptedFile(encrypted, paperId);

        const paper = await prisma.paper.create({
          data: {
            id: paperId,
            title,
            subject,
            examDate: new Date(examDate),
            uploadedBy: req.user.id,
            encryptedFilePath: filePath,
            encryptedAesKey: `${encryptedAesKey}:${masterIv}`,
            aesIv: ivHex,
            fileHash,
            releaseAt: releaseAt ? new Date(releaseAt) : null,
          },
        });

        await logAuditEvent('PAPER_UPLOADED', req.user.id, paper.id, {
          title, subject, fileHash, bulk: true, batchId,
        });

        results.push({ fileName: file.originalname, success: true, paperId: paper.id, title, fileHash: fileHash.slice(0, 16) });
      } catch (fileErr) {
        console.error('[BULK UPLOAD] File error:', fileErr.message);
        results.push({ fileName: file.originalname, success: false, error: 'Encryption or storage failed' });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = files.length - succeeded;

    await logAuditEvent('ADMIN_ACTION', req.user.id, null, {
      action: 'BULK_UPLOAD', batchId, total: files.length, succeeded, failed,
    });

    res.status(succeeded > 0 ? 201 : 400).json({ batchId, total: files.length, succeeded, failed, results });
  } catch (err) {
    console.error('[BULK UPLOAD] Error:', err.message);
    res.status(500).json({ error: 'Bulk upload failed' });
  }
});

// GET /api/papers — Admin and Super Admin
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const papers = await prisma.paper.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        title: true,
        subject: true,
        examDate: true,
        isReleased: true,
        releaseAt: true,
        createdAt: true,
        uploader: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(papers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch papers' });
  }
});

// GET /api/papers/assigned — MUST be before /:id route
router.get('/assigned', authenticate, async (req, res) => {
  try {
    const permissions = await prisma.paperPermission.findMany({
      where: {
        userId: req.user.id,
        isActive: true,
      },
      include: {
        paper: {
          select: {
            id: true,
            title: true,
            subject: true,
            examDate: true,
            isReleased: true,
            releaseAt: true,
            isDeleted: true,
          },
        },
      },
    });

    const papers = permissions
      .filter(p => !p.paper.isDeleted)
      .map(p => ({
        ...p.paper,
        status: p.paper.isReleased ? 'released' :
                p.paper.releaseAt ? 'locked' : 'no_schedule',
        secondsUntilRelease: p.paper.releaseAt
          ? Math.max(0, Math.floor((new Date(p.paper.releaseAt) - new Date()) / 1000))
          : null,
      }));

    res.json(papers);
  } catch (err) {
    console.error('[ASSIGNED] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch assigned papers' });
  }
});

// GET /api/papers/:id — get single paper metadata
router.get('/:id', authenticate, isAnyRole, async (req, res) => {
  try {
    const paper = await prisma.paper.findUnique({
      where: { id: req.params.id, isDeleted: false },
      select: {
        id: true,
        title: true,
        subject: true,
        examDate: true,
        isReleased: true,
        releaseAt: true,
        createdAt: true,
        uploader: {
          select: { name: true, email: true },
        },
      },
    });

    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    await logAuditEvent('PAPER_ACCESSED', req.user.id, paper.id, {
      ip: req.ip,
    });

    res.json(paper);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch paper' });
  }
});

// PATCH /api/papers/:id/schedule — set release time
router.patch('/:id/schedule', authenticate, isAdmin, async (req, res) => {
  try {
    const { releaseAt } = req.body;
    if (!releaseAt) return res.status(400).json({ error: 'releaseAt is required' });

    const paper = await prisma.paper.update({
      where: { id: req.params.id },
      data: { releaseAt: new Date(releaseAt) },
    });

    await logAuditEvent('ADMIN_ACTION', req.user.id, paper.id, {
      action: 'SCHEDULE_PAPER',
      releaseAt,
    });

    res.json({ message: 'Release time updated', releaseAt: paper.releaseAt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule paper' });
  }
});

// GET /api/papers/:id/status — release status
router.get('/:id/status', authenticate, isAnyRole, async (req, res) => {
  try {
    const paper = await prisma.paper.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, isReleased: true, releaseAt: true },
    });

    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const now = new Date();
    const secondsUntilRelease = paper.releaseAt
      ? Math.max(0, Math.floor((paper.releaseAt - now) / 1000))
      : null;

    res.json({
      id: paper.id,
      title: paper.title,
      isReleased: paper.isReleased,
      releaseAt: paper.releaseAt,
      secondsUntilRelease,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// DELETE /api/papers/:id — soft delete
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await prisma.paper.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
    });

    await logAuditEvent('ADMIN_ACTION', req.user.id, req.params.id, {
      action: 'DELETE_PAPER',
    });

    res.json({ message: 'Paper deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete paper' });
  }
});

module.exports = router;