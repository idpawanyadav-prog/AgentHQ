import 'dotenv/config';
import {createHash,randomBytes} from 'crypto';
import prisma from '../lib/prisma';
async function main() {
 if(await prisma.setting.findUnique({where:{key:'dashboard_auth'}})) throw new Error('Administrator already configured');
 const token=randomBytes(32).toString('hex');
 const value=JSON.stringify({tokenHash:createHash('sha256').update(token).digest('hex'),used:false,expiresAt:Date.now()+3600000});
 await prisma.setting.upsert({where:{key:'dashboard_setup_token'},create:{key:'dashboard_setup_token',value},update:{value}});
 console.log('One-time setup token (expires in one hour):\n'+token);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
