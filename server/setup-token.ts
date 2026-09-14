import 'dotenv/config';
import {createHash,randomBytes} from 'crypto';
import prisma from '../lib/prisma';

async function main() {
 const token=randomBytes(32).toString('hex');
 const value=JSON.stringify({tokenHash:createHash('sha256').update(token).digest('hex'),used:false,expiresAt:Date.now()+3600000});
 await prisma.setting.upsert({where:{key:'dashboard_setup_token'},create:{key:'dashboard_setup_token',value},update:{value}});
 console.log('One-time setup token:\n'+token);
 await prisma.$disconnect();
}

main().catch(e=>{console.error(e.message);process.exit(1);}).finally(()=>prisma.$disconnect());
