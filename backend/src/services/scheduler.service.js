const cron = require('node-cron');
const { prisma, logAuditEvent } = require('./audit.service');
const { sendPaperReleaseNotification } = require('./email.service');

async function notifyAssignedInvigilators(paper) {
  try {
    const permissions = await prisma.paperPermission.findMany({
      where: {
        paperId: paper.id,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    console.log(`[SCHEDULER] Notifying ${permissions.length} invigilator(s) for paper: ${paper.title}`);

    for (const permission of permissions) {
      await sendPaperReleaseNotification(
        permission.user.email,
        permission.user.name,
        paper.title
      );
    }
  } catch (err) {
    console.error('[SCHEDULER] Error notifying invigilators:', err.message);
  }
}

function startScheduler() {
  console.log('[SCHEDULER] Time-lock scheduler started — checking every minute');

  cron.schedule('* * * * *', async () => {
    try {
      const papersToRelease = await prisma.paper.findMany({
        where: {
          releaseAt: { lte: new Date() },
          isReleased: false,
          isDeleted: false,
        },
      });

      if (papersToRelease.length === 0) {
        return;
      }

      console.log(`[SCHEDULER] Found ${papersToRelease.length} paper(s) to release`);

      for (const paper of papersToRelease) {
        try {
          await prisma.paper.update({
            where: { id: paper.id },
            data: { isReleased: true },
          });

          await logAuditEvent('PAPER_RELEASED', null, paper.id, {
            title: paper.title,
            scheduledFor: paper.releaseAt,
            releasedAt: new Date().toISOString(),
            triggeredBy: 'cron_scheduler',
          });

          await notifyAssignedInvigilators(paper);

          console.log(`[SCHEDULER] Released paper: "${paper.title}" (${paper.id})`);
        } catch (paperErr) {
          console.error(`[SCHEDULER] Failed to release paper ${paper.id}:`, paperErr.message);
        }
      }
    } catch (err) {
      console.error('[SCHEDULER] Cron job error:', err.message);
    }
  });
}

module.exports = { startScheduler };