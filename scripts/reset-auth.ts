import prisma from './lib/prisma';

async function main() {
 await prisma.setting.delete({ where: { key: 'dashboard_auth' } }).catch(() => {});
 await prisma.setting.delete({ where: { key: 'dashboard_setup_token' } }).catch(() => {});
 console.log('Auth reset successful');
 await prisma.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
