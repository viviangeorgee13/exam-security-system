const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: 'superadmin@exam.local' },
  });

  if (existing) {
    console.log('Super Admin already exists. Skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash('SuperAdmin@123', 12);

  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Administrator',
      email: 'superadmin@exam.local',
      passwordHash,
      role: 'super_admin',
    },
  });

  console.log('Super Admin created:', superAdmin.email);
  console.log('Password: SuperAdmin@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());