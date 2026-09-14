const {createHmac,timingSafeEqual}=require('crypto');
const prisma=require('./prisma');
async function authenticate(cookie='') {
 const token=cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('dashboard_session='))?.slice('dashboard_session='.length);
 if(!token) return false;
 const record=await prisma.setting.findUnique({where:{key:'dashboard_auth'}});
 if(!record) return false;
 const {secret}=JSON.parse(record.value);
 const [expires,signature]=token.split('.');
 if(!expires || !signature || !Number.isFinite(Number(expires)) || Number(expires)<Date.now()) return false;
 const expected=createHmac('sha256',secret).update(expires).digest('hex');
 return signature.length===expected.length && timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
module.exports={authenticate};
