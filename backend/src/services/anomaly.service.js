const { prisma, logAuditEvent } = require('./audit.service');
const { sendAnomalyAlert } = require('./email.service');

async function runAnomalyCheck(userId, paperId, ipAddress) {
  let riskScore = 0;
  const reasons = [];

  try {
    // Rule 1: Download outside business hours (before 7am or after 10pm)
    const hour = new Date().getHours();
    if (hour < 7 || hour >= 22) {
      riskScore += 30;
      reasons.push('Download outside business hours');
    }

    // Rule 2: More than 3 downloads of same paper by same user
    const downloadCount = await prisma.download.count({
      where: { userId, paperId },
    });
    if (downloadCount > 3) {
      riskScore += 40;
      reasons.push(`Excessive downloads of same paper (${downloadCount} times)`);
    }

    // Rule 3: Download within 60 seconds of paper release
    const paper = await prisma.paper.findUnique({
      where: { id: paperId },
      select: { releaseAt: true, title: true },
    });
    if (paper?.releaseAt) {
      const secondsSinceRelease = (new Date() - new Date(paper.releaseAt)) / 1000;
      if (secondsSinceRelease <= 60) {
        riskScore += 20;
        reasons.push('Download within 60 seconds of paper release');
      }
    }

    // Rule 4: Same paper downloaded from two different IPs within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentDownloads = await prisma.download.findMany({
      where: {
        paperId,
        downloadedAt: { gte: fiveMinutesAgo },
      },
      select: { ipAddress: true, userId: true },
    });
    const uniqueIPs = new Set(recentDownloads.map(d => d.ipAddress));
    if (uniqueIPs.size >= 2) {
      riskScore += 60;
      reasons.push('Same paper downloaded from multiple IP addresses within 5 minutes');
    }

    // Rule 5: Multiple failed logins followed by successful login
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { failedAttempts: true, name: true, email: true },
    });
    if (user?.failedAttempts >= 3) {
      riskScore += 35;
      reasons.push(`Multiple failed login attempts detected (${user.failedAttempts} attempts)`);
    }

    // If risk score is high enough, create an anomaly record and alert
    if (riskScore >= 50) {
      // Save anomaly to database
      await prisma.anomaly.create({
        data: {
          userId,
          paperId,
          riskScore,
          reasons,
        },
      });

      // Log to audit trail
      await logAuditEvent('ANOMALY_DETECTED', userId, paperId, {
        riskScore,
        reasons,
        ipAddress,
      });

      // Find Super Admin to notify
      const superAdmin = await prisma.user.findFirst({
        where: { role: 'super_admin' },
        select: { email: true },
      });

      if (superAdmin) {
        await sendAnomalyAlert(
          superAdmin.email,
          user.name,
          paper.title,
          riskScore,
          reasons
        );
      }

      console.log(`[ANOMALY] Risk score ${riskScore} detected for user ${userId} on paper ${paperId}`);
    }

    return { riskScore, reasons };
  } catch (err) {
    console.error('[ANOMALY] Error running anomaly check:', err.message);
    return { riskScore: 0, reasons: [] };
  }
}

module.exports = { runAnomalyCheck };