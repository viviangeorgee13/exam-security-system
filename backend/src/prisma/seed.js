const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Starting demo data seed...');

  // ── Super Admin ──────────────────────────────────────────
  const existing = await prisma.user.findUnique({
    where: { email: 'superadmin@exam.local' },
  });
  if (!existing) {
    const passwordHash = await bcrypt.hash('SuperAdmin@123', SALT_ROUNDS);
    await prisma.user.create({
      data: {
        name: 'Super Administrator',
        email: 'superadmin@exam.local',
        passwordHash,
        role: 'super_admin',
      },
    });
    console.log('✅ Super Admin created');
  } else {
    console.log('ℹ️  Super Admin already exists');
  }

  // ── Admins ───────────────────────────────────────────────
  const admins = [
    { name: 'Alice Johnson',   email: 'alice@exam.local' },
    { name: 'Rahul Sharma',    email: 'rahul@exam.local' },
    { name: 'Sarah Lee',       email: 'sarah@exam.local' },
    { name: 'Mohammed Khan',   email: 'mohammed@exam.local' },
    { name: 'Priya Nair',      email: 'priya@exam.local' },
  ];

  const createdAdmins = [];
  for (const admin of admins) {
    const exists = await prisma.user.findUnique({ where: { email: admin.email } });
    if (!exists) {
      const passwordHash = await bcrypt.hash('Admin@123', SALT_ROUNDS);
      const created = await prisma.user.create({
        data: { name: admin.name, email: admin.email, passwordHash, role: 'admin' },
      });
      createdAdmins.push(created);
      console.log(`✅ Admin created: ${admin.name}`);
    } else {
      createdAdmins.push(exists);
      console.log(`ℹ️  Admin already exists: ${admin.name}`);
    }
  }

  // ── Invigilators ─────────────────────────────────────────
  const invigilators = [
    { name: 'John Smith',      email: 'john@exam.local' },
    { name: 'Emily Davis',     email: 'emily@exam.local' },
    { name: 'Michael Brown',   email: 'michael@exam.local' },
    { name: 'Ananya Patel',    email: 'ananya@exam.local' },
    { name: 'David Wilson',    email: 'david@exam.local' },
    { name: 'Sophia Turner',   email: 'sophia@exam.local' },
    { name: 'James Anderson',  email: 'james@exam.local' },
    { name: 'Meera Krishnan',  email: 'meera@exam.local' },
    { name: 'Robert Garcia',   email: 'robert@exam.local' },
    { name: 'Fatima Hassan',   email: 'fatima@exam.local' },
    { name: 'Daniel Martinez', email: 'daniel@exam.local' },
    { name: 'Lily Chen',       email: 'lily@exam.local' },
    { name: 'Omar Abdullah',   email: 'omar@exam.local' },
    { name: 'Kavya Reddy',     email: 'kavya@exam.local' },
    { name: 'Thomas Hughes',   email: 'thomas@exam.local' },
  ];

  const createdInvigilators = [];
  for (const inv of invigilators) {
    const exists = await prisma.user.findUnique({ where: { email: inv.email } });
    if (!exists) {
      const passwordHash = await bcrypt.hash('Invigilator@123', SALT_ROUNDS);
      const created = await prisma.user.create({
        data: { name: inv.name, email: inv.email, passwordHash, role: 'invigilator' },
      });
      createdInvigilators.push(created);
      console.log(`✅ Invigilator created: ${inv.name}`);
    } else {
      createdInvigilators.push(exists);
      console.log(`ℹ️  Invigilator already exists: ${inv.name}`);
    }
  }

  // ── Papers ───────────────────────────────────────────────
  const crypto = require('crypto');
  const fs = require('fs');
  const path = require('path');

  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const paperDefs = [
    { title: 'Mathematics Final Examination',     subject: 'Mathematics',           adminIndex: 0, examDate: '2026-08-10', releaseAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), isReleased: false },
    { title: 'Physics Advanced Paper',            subject: 'Physics',               adminIndex: 1, examDate: '2026-08-11', releaseAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), isReleased: false },
    { title: 'Chemistry Unit Test',               subject: 'Chemistry',             adminIndex: 2, examDate: '2026-08-12', releaseAt: new Date(Date.now() - 1 * 60 * 60 * 1000), isReleased: true },
    { title: 'Biology Midterm Examination',       subject: 'Biology',               adminIndex: 3, examDate: '2026-08-13', releaseAt: new Date(Date.now() - 2 * 60 * 60 * 1000), isReleased: true },
    { title: 'English Literature Paper',          subject: 'English',               adminIndex: 4, examDate: '2026-08-14', releaseAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), isReleased: false },
    { title: 'Computer Science Practical',        subject: 'Computer Science',      adminIndex: 0, examDate: '2026-08-15', releaseAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), isReleased: false },
    { title: 'Economics Theory Examination',      subject: 'Economics',             adminIndex: 1, examDate: '2026-08-16', releaseAt: new Date(Date.now() - 30 * 60 * 1000), isReleased: true },
    { title: 'History and Civilisation Paper',    subject: 'History',               adminIndex: 2, examDate: '2026-08-17', releaseAt: null, isReleased: false },
    { title: 'Geography Field Study Paper',       subject: 'Geography',             adminIndex: 3, examDate: '2026-08-18', releaseAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), isReleased: false },
    { title: 'Business Studies Case Paper',       subject: 'Business Studies',      adminIndex: 4, examDate: '2026-08-19', releaseAt: new Date(Date.now() - 3 * 60 * 60 * 1000), isReleased: true },
    { title: 'Environmental Science Assessment',  subject: 'Environmental Science', adminIndex: 0, examDate: '2026-08-20', releaseAt: null, isReleased: false },
  ];

  const createdPapers = [];
  for (const paperDef of paperDefs) {
    const exists = await prisma.paper.findFirst({ where: { title: paperDef.title } });
    if (exists) {
      createdPapers.push(exists);
      console.log(`ℹ️  Paper already exists: ${paperDef.title}`);
      continue;
    }

    // Create a dummy encrypted file
    const paperId = crypto.randomUUID();
    const dummyContent = Buffer.from(`EXAM PAPER: ${paperDef.title}\nSUBJECT: ${paperDef.subject}\nCONFIDENTIAL`);

    // Encrypt with AES-256-CBC
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    const encrypted = Buffer.concat([cipher.update(dummyContent), cipher.final()]);
    const fileHash = crypto.createHash('sha256').update(dummyContent).digest('hex');

    // Encrypt AES key with master key
    const masterKey = Buffer.from(process.env.MASTER_ENCRYPTION_KEY || 'examSecuritySystemMasterKey12345', 'utf8');
    const masterIv = crypto.randomBytes(16);
    const keyCipher = crypto.createCipheriv('aes-256-cbc', masterKey, masterIv);
    const encryptedKey = Buffer.concat([keyCipher.update(aesKey), keyCipher.final()]);

    // Save encrypted file
    const filePath = path.join(uploadsDir, `${paperId}.enc`);
    fs.writeFileSync(filePath, encrypted);

    const uploader = createdAdmins[paperDef.adminIndex];
    const paper = await prisma.paper.create({
      data: {
        id: paperId,
        title: paperDef.title,
        subject: paperDef.subject,
        examDate: new Date(paperDef.examDate),
        uploadedBy: uploader.id,
        encryptedFilePath: filePath,
        encryptedAesKey: `${encryptedKey.toString('hex')}:${masterIv.toString('hex')}`,
        aesIv: iv.toString('hex'),
        fileHash,
        isReleased: paperDef.isReleased,
        releaseAt: paperDef.releaseAt,
      },
    });
    createdPapers.push(paper);
    console.log(`✅ Paper created: ${paperDef.title}`);
  }

  // ── Permissions ──────────────────────────────────────────
  const superAdmin = await prisma.user.findUnique({
    where: { email: 'superadmin@exam.local' },
  });

  const permissionMap = [
    // Paper 0 - Mathematics
    { paperIndex: 0, invigilatorIndices: [0, 1, 2] },
    // Paper 1 - Physics
    { paperIndex: 1, invigilatorIndices: [3, 4, 5] },
    // Paper 2 - Chemistry (released)
    { paperIndex: 2, invigilatorIndices: [6, 7, 8] },
    // Paper 3 - Biology (released)
    { paperIndex: 3, invigilatorIndices: [9, 10, 11] },
    // Paper 4 - English
    { paperIndex: 4, invigilatorIndices: [12, 13, 14] },
    // Paper 5 - Computer Science
    { paperIndex: 5, invigilatorIndices: [0, 3, 6] },
    // Paper 6 - Economics (released)
    { paperIndex: 6, invigilatorIndices: [1, 4, 7] },
    // Paper 7 - History
    { paperIndex: 7, invigilatorIndices: [2, 5, 8] },
    // Paper 8 - Geography
    { paperIndex: 8, invigilatorIndices: [9, 12, 14] },
    // Paper 9 - Business Studies (released)
    { paperIndex: 9, invigilatorIndices: [10, 13, 0] },
    // Paper 10 - Environmental Science
    { paperIndex: 10, invigilatorIndices: [11, 1, 4] },
  ];

  for (const pm of permissionMap) {
    const paper = createdPapers[pm.paperIndex];
    if (!paper) continue;
    for (const invIndex of pm.invigilatorIndices) {
      const inv = createdInvigilators[invIndex];
      if (!inv) continue;
      const exists = await prisma.paperPermission.findUnique({
        where: { paperId_userId: { paperId: paper.id, userId: inv.id } },
      });
      if (!exists) {
        await prisma.paperPermission.create({
          data: {
            paperId: paper.id,
            userId: inv.id,
            grantedBy: superAdmin.id,
          },
        });
        console.log(`✅ Permission: ${inv.name} → ${paper.title}`);
      }
    }
  }

  console.log('\n🎉 Demo data seed complete!');
  console.log('\n📋 Login credentials:');
  console.log('Super Admin: superadmin@exam.local / SuperAdmin@123');
  console.log('Admins:      alice@exam.local / Admin@123');
  console.log('             rahul@exam.local / Admin@123');
  console.log('             sarah@exam.local / Admin@123');
  console.log('             mohammed@exam.local / Admin@123');
  console.log('             priya@exam.local / Admin@123');
  console.log('Invigilators: john@exam.local / Invigilator@123');
  console.log('              emily@exam.local / Invigilator@123');
  console.log('              (and 13 more with same password)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());