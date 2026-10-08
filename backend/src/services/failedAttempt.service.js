const { prisma, logAuditEvent } = require('./audit.service');
const { sendAnomalyAlert } = require('./email.service');

const FAILURE_EVENTS = ['DOWNLOAD_BLOCKED', 'DOWNLOAD_OTP_VERIFICATION_FAILED', 'DOWNLOAD_OTP_EXPIRED'];
const WINDOW_MS = 15 * 60 * 1000;   // look back 15 minutes
const THRESHOLD = 3;                // failures that trigger an anomaly
const RISK_SCORE = 55;              // above the anomaly threshold of 50

// Records one failed download attempt and checks whether it forms a pattern.
// Everything is awaited in order: audit entries must be written one at a time
// so the hash chain stays intact.
async function recordFailedAttempt({ userId, paperId, reason, req, eventType = 'DOWNLOAD_BLOCKED', extra = {} }) {
  try {
    await logAuditEvent(eventType, userId, paperId, {
      reason,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
      ...extra,
    });
    await checkRepeatedFailures(userId, paperId);
  } catch (err) {
    console.error('[FAILED ATTEMPT] Error:', err.message);
  }
}

async function checkRepeatedFailures(userId, paperId) {
  if (!paperId) return;

  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await prisma.auditLog.count({
    where: { userId, eventType: { in: FAILURE_EVENTS }, createdAt: { gte: since } },
  });

  // Alert at 3, 6, 9... so one burst does not raise an anomaly per attempt
  if (recent < THRESHOLD || recent % THRESHOLD !== 0) return;

  const reasons = [`${recent} failed download attempts within 15 minutes`];

  await prisma.anomaly.create({
    data: { userId, paperId, riskScore: RISK_SCORE, reasons },
  });

  await logAuditEvent('ANOMALY_DETECTED', userId, paperId, {
    riskScore: RISK_SCORE,
    reasons,
    source: 'failed_download_attempts',
  });

  const [user, paper, superAdmin] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.paper.findUnique({ where: { id: paperId }, select: { title: true } }),
    prisma.user.findFirst({ where: { role: 'super_admin' }, select: { email: true } }),
  ]);

  // Email is the only step allowed to run in the background - it writes no audit entry
  if (superAdmin) {
    sendAnomalyAlert(superAdmin.email, user?.name || 'Unknown', paper?.title || 'Unknown', RISK_SCORE, reasons)
      .catch(err => console.error('[FAILED ATTEMPT] Alert email error:', err.message));
  }
}

module.exports = { recordFailedAttempt, FAILURE_EVENTS };