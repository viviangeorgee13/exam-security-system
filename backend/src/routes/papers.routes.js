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

// Multer setup — store file in memory temporarily
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    // Server-side validation — only allow PDF
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

    const paperId = uuidv4();

    // Encrypt the file
    const { encrypted, aesKey, iv, fileHash } = encryptPaper(req.file.buffer);

    // Encrypt the AES key with master key
    const { encryptedAesKey, masterIv, ivHex } = encryptAesKey(aesKey, iv);

    // Save encrypted file to disk
    const filePath = saveEncryptedFile(encrypted, paperId);

    // Store metadata in database
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