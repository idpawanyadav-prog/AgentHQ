/** @jest-environment node */
import http from 'http';
import {safeFetch} from '../lib/safe-fetch';
import {isPrivateAddress} from '../lib/ssrf-guard';
test('blocks IPv6 encodings and transition ranges that reach private networks',()=>{
 for(const ip of ['::ffff:7f00:1','fe90::1','2002:7f00:1::'])expect(isPrivateAddress(ip)).toBe(true);
});
test('refuses redirects rather than following them with credentials',async()=>{
 let calls=0;
 const server=http.createServer((_req,res)=>{calls++;res.writeHead(302,{Location:'http://169.254.169.254/latest'});res.end();});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${(server.address() as any).port}`;
 const old=process.env.GATEWAY_ALLOWED_ORIGINS;process.env.GATEWAY_ALLOWED_ORIGINS=origin;
 try {await expect(safeFetch(origin,{headers:{Authorization:'Bearer test'}})).rejects.toThrow('redirects');expect(calls).toBe(1);}
 finally {if(old===undefined)delete process.env.GATEWAY_ALLOWED_ORIGINS;else process.env.GATEWAY_ALLOWED_ORIGINS=old;await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
