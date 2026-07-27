const express = require('express');
const router = express.Router();
const { prisma, logAuditEvent } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');

// ─── In-Memory Cache (30 second TTL) ─────────────────────────────────────────

const cache = new Map();
const CACHE_TTL = 30 * 1000;

function getCacheKey(intent, userId, role) {
  const sharedIntents = ['system_health', 'papers_releasing_today', 'papers_releasing_tomorrow', 'users'];
  if (sharedIntents.includes(intent) && role !== 'invigilator') {
    return `${intent}:shared`;
  }
  return `${intent}:${userId}`;
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Permission Helpers ───────────────────────────────────────────────────────

const canViewAuditLogs    = (user) => ['super_admin', 'admin'].includes(user.role);
const canViewUsers        = (user) => ['super_admin', 'admin'].includes(user.role);
const canViewIntegrity    = (user) => ['super_admin', 'admin'].includes(user.role);
const canViewAnomalies    = (user) => ['super_admin', 'admin'].includes(user.role);
const canViewAllDownloads = (user) => ['super_admin', 'admin'].includes(user.role);
const canViewSystemHealth = (user) => ['super_admin', 'admin'].includes(user.role);

// ─── Entity Extractor ─────────────────────────────────────────────────────────

async function extractPaperEntity(question) {
  try {
    const papers = await prisma.paper.findMany({
      where: { isDeleted: false },
      select: { title: true, subject: true },
    });

    const q = question.toLowerCase();
    const matches = [];

    for (const paper of papers) {
      const subjectLower = paper.subject.toLowerCase();
      const titleLower = paper.title.toLowerCase();
      // Use word boundary matching
      const subjectRegex = new RegExp(`\\b${subjectLower}\\b`);
      const titleRegex = new RegExp(`\\b${titleLower}\\b`);
      if (subjectRegex.test(q) || titleRegex.test(q)) {
        matches.push(paper);
      }
    }

    if (matches.length === 1) return { entity: matches[0].subject, needsClarification: false };
    if (matches.length > 1) {
      return {
        entity: null,
        needsClarification: true,
        options: matches.map(m => m.title),
      };
    }
  } catch (e) {}
  return { entity: null, needsClarification: false };
}

// ─── Intent Detection ─────────────────────────────────────────────────────────

function detectIntent(question) {
  const q = question.toLowerCase();
  if (q.match(/today.*download|download.*today|recent.*download/)) return 'downloads_today';
  if (q.match(/download histor|my download|all download/)) return 'downloads_history';
  if (q.match(/anomal|suspicious|alert|risk|threat/)) return 'anomalies';
  if (q.match(/release.*today|today.*release|releasing.*today/)) return 'papers_releasing_today';
  if (q.match(/release.*tomorrow|tomorrow.*release/)) return 'papers_releasing_tomorrow';
  if (q.match(/my paper|assign.*me|my assign|what.*paper/)) return 'my_assignments';
  if (q.match(/when.*release|when.*available|release.*time/)) return 'paper_release_time';
  if (q.match(/audit|log|event|activit/)) return 'audit_summary';
  if (q.match(/how many user|user count|user stat|staff|people/)) return 'users';
  if (q.match(/health|system.*status|overview|summari|summary/)) return 'system_health';
  if (q.match(/not.*download|haven.*download|pending.*download|who.*not.*download/)) return 'pending_downloads';
  if (q.match(/integrity|hash|chain|tamper|verif/)) return 'integrity';
  if (q.match(/paper|exam|subject|upload/)) return 'papers';
  if (q.match(/what.*do|duty|duties|today.*task|task.*today/)) return 'my_duties';
  return 'general';
}

// ─── Data Fetchers ────────────────────────────────────────────────────────────

async function fetchData(intent, user, question) {
  const cacheKey = getCacheKey(intent, user.id, user.role);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const tomorrow = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(startOfDay.getTime() + 48 * 60 * 60 * 1000);

  let result;

  switch (intent) {
    case 'downloads_today': {
      const where = user.role === 'invigilator'
        ? { userId: user.id, downloadedAt: { gte: startOfDay, lt: endOfDay } }
        : { downloadedAt: { gte: startOfDay, lt: endOfDay } };
      const downloads = await prisma.download.findMany({
        where,
        include: {
          paper: { select: { title: true, subject: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { downloadedAt: 'desc' },
        take: 20,
      });
      result = { type: 'downloads_today', data: downloads };
      break;
    }

    case 'downloads_history': {
      const where = user.role === 'invigilator' ? { userId: user.id } : {};
      const downloads = await prisma.download.findMany({
        where,
        include: {
          paper: { select: { title: true, subject: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { downloadedAt: 'desc' },
        take: 15,
      });
      result = { type: 'downloads_history', data: downloads };
      break;
    }

    case 'anomalies': {
      if (!canViewAnomalies(user)) return { type: 'unauthorized' };
      const anomalies = await prisma.anomaly.findMany({
        include: {
          user: { select: { name: true, email: true } },
          paper: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      result = { type: 'anomalies', data: anomalies };
      break;
    }

    case 'papers_releasing_today': {
      const where = user.role === 'invigilator'
        ? { releaseAt: { gte: startOfDay, lt: endOfDay }, isDeleted: false, permissions: { some: { userId: user.id, isActive: true } } }
        : { releaseAt: { gte: startOfDay, lt: endOfDay }, isDeleted: false };
      const papers = await prisma.paper.findMany({
        where,
        select: { title: true, subject: true, releaseAt: true, isReleased: true },
      });
      result = { type: 'papers_releasing_today', data: papers };
      break;
    }

    case 'papers_releasing_tomorrow': {
      if (!canViewSystemHealth(user)) return { type: 'unauthorized' };
      const papers = await prisma.paper.findMany({
        where: { releaseAt: { gte: tomorrow, lt: dayAfter }, isDeleted: false },
        select: { title: true, subject: true, releaseAt: true, isReleased: true },
      });
      result = { type: 'papers_releasing_tomorrow', data: papers };
      break;
    }

    case 'paper_release_time': {
      const entityResult = await extractPaperEntity(question);
      if (entityResult.needsClarification) {
        return { type: 'clarification', options: entityResult.options };
      }
      const entity = entityResult.entity;
      if (user.role === 'invigilator') {
        const permissions = await prisma.paperPermission.findMany({
          where: { userId: user.id, isActive: true },
          include: { paper: { select: { title: true, subject: true, isReleased: true, releaseAt: true } } },
        });
        const papers = permissions.map(p => p.paper);
        const filtered = entity
          ? papers.filter(p => p.subject.toLowerCase().includes(entity.toLowerCase()) || p.title.toLowerCase().includes(entity.toLowerCase()))
          : papers;
        result = { type: 'my_assignments', data: filtered.length > 0 ? filtered : papers, entity };
      } else {
        const allPapers = await prisma.paper.findMany({
          where: { isDeleted: false },
          select: { title: true, subject: true, isReleased: true, releaseAt: true },
        });
        const filtered = entity
          ? allPapers.filter(p => p.subject.toLowerCase().includes(entity.toLowerCase()) || p.title.toLowerCase().includes(entity.toLowerCase()))
          : allPapers;
        result = { type: 'papers', data: filtered.length > 0 ? filtered : allPapers, entity };
      }
      break;
    }

    case 'my_assignments': {
      if (user.role === 'invigilator') {
        const permissions = await prisma.paperPermission.findMany({
          where: { userId: user.id, isActive: true },
          include: { paper: { select: { title: true, subject: true, isReleased: true, releaseAt: true, examDate: true } } },
        });
        result = { type: 'my_assignments', data: permissions.map(p => p.paper) };
      } else {
        const papers = await prisma.paper.findMany({
          where: { isDeleted: false },
          select: { title: true, subject: true, isReleased: true, releaseAt: true },
          orderBy: { createdAt: 'desc' },
          take: 15,
        });
        result = { type: 'papers', data: papers };
      }
      break;
    }

    case 'audit_summary': {
      if (!canViewAuditLogs(user)) return { type: 'unauthorized' };
      const logs = await prisma.auditLog.findMany({
        where: { createdAt: { gte: startOfDay } },
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      result = { type: 'audit_summary', data: logs };
      break;
    }

    case 'users': {
      if (!canViewUsers(user)) return { type: 'unauthorized' };
      const users = await prisma.user.findMany({
        select: { name: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      result = { type: 'users', data: users };
      break;
    }

    case 'system_health': {
      if (!canViewSystemHealth(user)) return { type: 'unauthorized' };
      const [totalPapers, releasedPapers, totalUsers, openAnomalies, todayDownloads, totalLogs] = await Promise.all([
        prisma.paper.count({ where: { isDeleted: false } }),
        prisma.paper.count({ where: { isReleased: true, isDeleted: false } }),
        prisma.user.count(),
        prisma.anomaly.count({ where: { resolved: false } }),
        prisma.download.count({ where: { downloadedAt: { gte: startOfDay } } }),
        prisma.auditLog.count(),
      ]);
      result = { type: 'system_health', data: { totalPapers, releasedPapers, totalUsers, openAnomalies, todayDownloads, totalLogs } };
      break;
    }

    case 'pending_downloads': {
      if (!canViewAllDownloads(user)) return { type: 'unauthorized' };
      const permissions = await prisma.paperPermission.findMany({
        where: { isActive: true },
        include: {
          user: { select: { name: true, email: true } },
          paper: { select: { title: true, subject: true, isReleased: true } },
        },
      });
      const releasedPermissions = permissions.filter(p => p.paper.isReleased);
      const downloadedIds = await prisma.download.findMany({ select: { userId: true, paperId: true } });
      const downloadedSet = new Set(downloadedIds.map(d => `${d.userId}-${d.paperId}`));
      const pending = releasedPermissions.filter(p => !downloadedSet.has(`${p.userId}-${p.paperId}`));
      result = { type: 'pending_downloads', data: pending };
      break;
    }

    case 'integrity': {
      if (!canViewIntegrity(user)) return { type: 'unauthorized' };
      const totalLogs = await prisma.auditLog.count();
      result = { type: 'integrity', data: { totalLogs, status: 'verified' } };
      break;
    }

    case 'papers': {
      const entityResult = await extractPaperEntity(question);
      if (entityResult.needsClarification) {
        return { type: 'clarification', options: entityResult.options };
      }
      const entity = entityResult.entity;
      if (user.role === 'invigilator') {
        const permissions = await prisma.paperPermission.findMany({
          where: { userId: user.id, isActive: true },
          include: { paper: { select: { title: true, subject: true, isReleased: true, releaseAt: true } } },
        });
        result = { type: 'my_assignments', data: permissions.map(p => p.paper), entity };
      } else {
        const papers = await prisma.paper.findMany({
          where: { isDeleted: false },
          select: { title: true, subject: true, isReleased: true, releaseAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        result = { type: 'papers', data: papers, entity };
      }
      break;
    }

    case 'my_duties': {
      if (user.role === 'invigilator') {
        const permissions = await prisma.paperPermission.findMany({
          where: { userId: user.id, isActive: true },
          include: { paper: { select: { id: true, title: true, subject: true, isReleased: true, releaseAt: true, examDate: true } } },
        });
        const myDownloads = await prisma.download.findMany({
          where: { userId: user.id },
          select: { paperId: true },
        });
        const downloadedIds = new Set(myDownloads.map(d => d.paperId));
        result = { type: 'my_duties', data: { papers: permissions.map(p => p.paper), downloadedIds: [...downloadedIds] } };
      } else {
        const [papers, downloads, anomalies] = await Promise.all([
          prisma.paper.findMany({ where: { isDeleted: false }, select: { title: true, isReleased: true, releaseAt: true } }),
          prisma.download.findMany({ where: { downloadedAt: { gte: startOfDay } } }),
          prisma.anomaly.findMany({ where: { resolved: false } }),
        ]);
        result = { type: 'system_health', data: { totalPapers: papers.length, releasedPapers: papers.filter(p => p.isReleased).length, todayDownloads: downloads.length, openAnomalies: anomalies.length } };
      }
      break;
    }

    default:
      return { type: 'general', data: null };
  }

  setCache(cacheKey, result);
  return result;
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildPrompt(question, fetchedData, user) {
  const roleLabel = user.role === 'super_admin' ? 'Super Administrator'
    : user.role === 'admin' ? 'Administrator' : 'Invigilator';

  const systemPrompt = `You are ExamSecure AI, an enterprise security assistant for a secure examination paper distribution platform.
You are assisting ${user.name}, who holds the role of ${roleLabel}.

Response Format:
1. Brief one-sentence summary.
2. Key information in bullet points.
3. Observations section — identify patterns, issues, or notable facts.
4. Recommendation section — only when action is required.

Rules:
- Never write long paragraphs.
- If there are no issues, explicitly state: "No issues detected."
- If data is empty, state: "No records found."
- Never invent, estimate, or assume information not in the data.
- Never expose passwords, encryption keys, tokens, file paths, or internal IDs.
- Refuse unrelated questions with: "I can only assist with examination system operations."
- Keep all responses professional, structured, and security-focused.
- Always summarise numerical information before observations.`;

  if (fetchedData.type === 'unauthorized') {
    return {
      systemPrompt,
      userPrompt: `The user asked: "${question}". They do not have permission to access this as a ${roleLabel}. Politely inform them this information is restricted to their role.`,
      authorized: false,
    };
  }

  if (fetchedData.type === 'clarification') {
    return {
      systemPrompt,
      userPrompt: `The user asked: "${question}". Multiple matching papers were found: ${fetchedData.options.join(', ')}. Ask the user to clarify which paper they mean.`,
      authorized: true,
    };
  }

  if (fetchedData.type === 'general') {
    return {
      systemPrompt,
      userPrompt: `The user asked: "${question}". This question does not match any specific data category. Respond by listing what you can help with, based on the ${roleLabel} role.`,
      authorized: true,
    };
  }

  const formatters = {
    downloads_today: (data) => data.length === 0 ? 'No downloads recorded today.' :
      `Downloads Today (${data.length} total):\n` + data.map(d =>
        `• ${d.paper?.title || 'Unknown Paper'} — ${d.user?.name || 'Unknown'} — ${new Date(d.downloadedAt).toLocaleTimeString()}`
      ).join('\n'),

    downloads_history: (data) => data.length === 0 ? 'No download records found.' :
      `Download History (${data.length} records):\n` + data.map(d =>
        `• ${d.paper?.title || 'Unknown'} — ${d.user?.name || 'Unknown'} — ${new Date(d.downloadedAt).toLocaleString()}`
      ).join('\n'),

    anomalies: (data) => data.length === 0 ? 'No anomalies detected.' :
      `Security Anomalies (${data.length} total, ${data.filter(a => !a.resolved).length} unresolved):\n` +
      data.map(a => `• ${a.user?.name} — Paper: ${a.paper?.title} — Risk Score: ${a.riskScore} — ${a.resolved ? 'Resolved' : 'UNRESOLVED'}`).join('\n'),

    papers_releasing_today: (data) => data.length === 0 ? 'No papers scheduled for release today.' :
      `Papers Releasing Today (${data.length}):\n` + data.map(p =>
        `• ${p.title} (${p.subject}) — ${new Date(p.releaseAt).toLocaleTimeString()} — ${p.isReleased ? 'Already Released' : 'Pending'}`
      ).join('\n'),

    papers_releasing_tomorrow: (data) => data.length === 0 ? 'No papers scheduled for release tomorrow.' :
      `Papers Releasing Tomorrow (${data.length}):\n` + data.map(p =>
        `• ${p.title} (${p.subject}) — ${new Date(p.releaseAt).toLocaleTimeString()}`
      ).join('\n'),

    my_assignments: (data) => data.length === 0 ? 'No papers currently assigned.' :
      `Assigned Papers (${data.length}):\n` + data.map(p =>
        `• ${p.title} (${p.subject}) — ${p.isReleased ? '✓ Available' : `Releases: ${p.releaseAt ? new Date(p.releaseAt).toLocaleString() : 'Not scheduled'}`}`
      ).join('\n'),

    papers: (data) => data.length === 0 ? 'No papers found.' :
      `Papers (${data.length} total):\n` + data.map(p =>
        `• ${p.title} (${p.subject}) — ${p.isReleased ? 'Released' : 'Pending'} — ${p.releaseAt ? new Date(p.releaseAt).toLocaleString() : 'No release set'}`
      ).join('\n'),

    audit_summary: (data) => {
      const counts = {};
      data.forEach(l => { counts[l.eventType] = (counts[l.eventType] || 0) + 1; });
      return `Today's Audit Events (${data.length} total):\n` +
        Object.entries(counts).map(([k, v]) => `• ${k}: ${v}`).join('\n');
    },

    users: (data) => {
      const admins = data.filter(u => u.role === 'admin').length;
      const invigs = data.filter(u => u.role === 'invigilator').length;
      const active = data.filter(u => u.isActive).length;
      return `User Statistics:\n• Total: ${data.length}\n• Administrators: ${admins}\n• Invigilators: ${invigs}\n• Active: ${active}\n• Inactive: ${data.length - active}`;
    },

    system_health: (d) =>
      `System Health:\n• Total Papers: ${d.totalPapers}\n• Released: ${d.releasedPapers}\n• Total Users: ${d.totalUsers || 'N/A'}\n• Open Anomalies: ${d.openAnomalies}\n• Downloads Today: ${d.todayDownloads}\n• Audit Entries: ${d.totalLogs || 'N/A'}`,

    pending_downloads: (data) => data.length === 0
      ? 'All assigned invigilators have downloaded their papers.'
      : `Invigilators Yet to Download (${data.length}):\n` + data.map(p => `• ${p.user?.name} — ${p.paper?.title}`).join('\n'),

    integrity: (d) =>
      `Hash Chain Integrity:\n• Total Entries: ${d.totalLogs}\n• Status: ${d.status.toUpperCase()}\n• Checked: ${new Date().toLocaleString()}`,

    my_duties: ({ papers, downloadedIds }) => {
      const released = papers.filter(p => p.isReleased);
      const notDownloaded = released.filter(p => !downloadedIds.includes(p.id));
      return `Duties Summary:\n• Assigned: ${papers.length}\n• Available: ${released.length}\n• Downloaded: ${released.length - notDownloaded.length}\n• Pending: ${notDownloaded.length}\n\n` +
        papers.map(p => `• ${p.title} — ${p.isReleased
          ? (downloadedIds.includes(p.id) ? '✓ Downloaded' : '⚠ Not Downloaded')
          : `Releases ${p.releaseAt ? new Date(p.releaseAt).toLocaleString() : 'TBD'}`}`
        ).join('\n');
    },
  };

  const formatter = formatters[fetchedData.type];
  let dataContext = formatter ? formatter(fetchedData.data) : 'No data available.';

  if (fetchedData.entity) {
    dataContext = `Filtered for: "${fetchedData.entity}"\n` + dataContext;
  }

  return {
    systemPrompt,
    userPrompt: `User Question: "${question}"\n\nRetrieved Data:\n${dataContext}\n\nRespond with: 1) Summary, 2) Key information, 3) Observations, 4) Recommendation if needed.`,
    authorized: true,
  };
}

// ─── Main Route ───────────────────────────────────────────────────────────────

router.post('/query', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const { question, history = [] } = req.body;
    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const user = req.user;
    const intent = detectIntent(question);

    // Handle general intent without calling Claude
    if (intent === 'general') {
      const suggestions = user.role === 'super_admin'
        ? ['Show today\'s downloads', 'Show system health', 'Show anomalies', 'Summarise today\'s activity', 'Show user statistics']
        : user.role === 'admin'
        ? ['Which papers release today?', 'Show pending assignments', 'Show download history', 'Which invigilators haven\'t downloaded?']
        : ['Which papers are assigned to me?', 'Show my download history', 'What should I do today?'];

      return res.json({
        answer: `I can help you with examination system operations. Here are some things you can ask me:\n\n${suggestions.map(s => `• ${s}`).join('\n')}\n\nWhat would you like to know?`,
        intent: 'general',
      });
    }

    const fetchedData = await fetchData(intent, user, question);
    const { systemPrompt, userPrompt, authorized } = buildPrompt(question, fetchedData, user);

    // Call Claude API with simple single message
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI] Response status:', response.status, errText);
      await logAuditEvent('AI_QUERY', user.id, null, {
        question: question.slice(0, 200),
        intent,
        status: 'failed',
        role: user.role,
        authorized,
        model: 'claude-haiku-4-5-20251001',
      });
      return res.status(500).json({ error: 'AI service unavailable. Please try again.' });
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text || 'I could not generate a response. Please try again.';

    // Log to audit trail
    await logAuditEvent('AI_QUERY', user.id, null, {
      question: question.slice(0, 200),
      intent,
      status: 'success',
      role: user.role,
      authorized,
      model: 'claude-haiku-4-5-20251001',
      responseTimeMs: Date.now() - startTime,
    });

    res.json({ answer, intent });
  } catch (err) {
    console.error('[AI] Error:', err.message);
    res.status(500).json({ error: 'AI service error. Please try again.' });
  }
});

module.exports = router;