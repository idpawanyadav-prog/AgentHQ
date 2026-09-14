import {createHash,randomUUID} from 'crypto';
import prisma from './prisma';
/** SQLite's upsert serializes counters across web instances. */
export async function allowLogin(ip:string) {
 const now=Date.now(),bucket=Math.floor(now/60000);
 const key=`auth_rate:${createHash('sha256').update(ip).digest('hex')}:${bucket}`;
 const changed=await prisma.$executeRaw`INSERT INTO "Setting" ("id","key","value","createdAt","updatedAt") VALUES (${randomUUID()},${key},'1',${new Date()},${new Date()}) ON CONFLICT("key") DO UPDATE SET "value"=CAST(CAST("value" AS INTEGER)+1 AS TEXT),"updatedAt"=${new Date()} WHERE CAST("value" AS INTEGER)<10`;
 await prisma.setting.deleteMany({where:{key:{startsWith:'auth_rate:'},createdAt:{lt:new Date(now-120000)}}});
 return changed>0;
}
