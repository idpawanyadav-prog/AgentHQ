import http from 'http';
import https from 'https';
import { parseSafeUrl, SsrfError } from './ssrf-guard';

/** Resolve once, connect only to a validated address, and refuse redirects. */
export async function safeFetch(raw: string, init: RequestInit = {}): Promise<Response> {
  const {url,addresses} = await parseSafeUrl(raw);
  const address=addresses[0];
  return new Promise((resolve,reject)=>{
    const request=(url.protocol==='https:'?https:http).request(url,{
      method:init.method || 'GET', headers:Object.fromEntries(new Headers(init.headers).entries()),
      agent:false, signal:init.signal || undefined,
      lookup:((_host: string, options: any, callback: any)=>{
        if(options?.all) callback(null,[address]);
        else callback(null,address.address,address.family);
      }) as any,
    },res=>{
      const code=res.statusCode || 502;
      if(code>=300 && code<400) {res.resume();reject(new SsrfError('Gateway redirects are not allowed; configure the final URL'));return;}
      const chunks:Buffer[]=[];let size=0;
      res.on('data',(chunk:Buffer)=>{
        size+=chunk.length;
        if(size>8*1024*1024) {request.destroy(new Error('Provider response exceeds 8 MB'));return;}
        chunks.push(chunk);
      });
      res.on('error',reject);
      res.on('end',()=>{
        const headers=new Headers();
        for(const [key,value] of Object.entries(res.headers)) if(value) headers.set(key,Array.isArray(value)?value.join(', '):value);
        resolve(new Response([204,205,304].includes(code)?null:Buffer.concat(chunks),{status:code,headers}));
      });
    });
    request.setTimeout(120000,()=>request.destroy(new Error('Provider timed out')));
    request.on('error',reject);
    if(init.body) request.write(String(init.body));
    request.end();
  });
}
