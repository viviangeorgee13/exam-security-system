const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function logAuditEvent(eventType, userId, paperId = null, metadata = {}) {
  try {
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const previousHash = lastLog ? lastLog.currentHash : '0'.repeat(64);

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const hashInput = `${id}${eventType}${userId || ''}${timestamp}${previousHash}`;
    const currentHash = crypto
      .createHash('sha256')
      .update(hashInput)
      .digest('hex');

    await prisma.auditLog.create({
      data: {
        id,
        eventType,
        userId: userId || null,
        paperId: paperId || null,
        metadata,
        previousHash,
        currentHash,
        createdAt: new Date(timestamp),
      },
    });

    return { id, currentHash };
  } catch (err) {
    console.error('[AUDIT ERROR]', err.message);
  }
}

async function verifyHashChain() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (logs.length === 0) {
    return { valid: true, message: 'No logs to verify', brokenAt: null };
  }

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    const expectedHashInput = `${log.id}${log.eventType}${log.userId || ''}${log.createdAt.toISOString()}${log.previousHash}`;
    const expectedHash = crypto
      .createHash('sha256')
      .update(expectedHashInput)
      .digest('hex');

    if (expectedHash !== log.currentHash) {
      return {
        valid: false,
        message: `Hash chain broken at entry ${i + 1}`,
        brokenAt: {
          index: i + 1,
          logId: log.id,
          eventType: log.eventType,
          createdAt: log.createdAt,
        },
      };
    }

    if (i > 0 && log.previousHash !== logs[i - 1].currentHash) {
      return {
        valid: false,
        message: `Chain linkage broken between entry ${i} and ${i + 1}`,
        brokenAt: {
          index: i + 1,
          logId: log.id,
          eventType: log.eventType,
          createdAt: log.createdAt,
        },
      };
    }
  }

  return {
    valid: true,
    message: `All ${logs.length} entries verified`,
    brokenAt: null,
  };
}

module.exports = { logAuditEvent, verifyHashChain, prisma };