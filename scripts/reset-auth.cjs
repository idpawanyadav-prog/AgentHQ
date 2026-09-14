const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
 try {
 await prisma.setting.delete({ where: { key: 'dashboard_auth' } }).catch(() => {});
 await prisma.setting.delete({ where: { key: 'dashboard_setup_token' } }).catch(() => {});
 console.log('Auth reset successful');
 } catch (e) {
 console.error(e.message);
 process.exit(1);
 } finally {
 await prisma.$disconnect();
 }
}

main();
