const {spawn}=require('child_process');
const path=require('path');
const root=path.resolve(__dirname,'..');
const processes=[
 ['node_modules/next/dist/bin/next','start','-p',process.env.WEB_PORT || '3000'],
 ['server/index.js'],
 ['node_modules/tsx/dist/cli.mjs','server/worker.ts'],
].map(args=>spawn(process.execPath,[path.join(root,args[0]),...args.slice(1)],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,NODE_ENV:'production'}}));
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;processes.forEach(p=>p.kill());process.exitCode=code;}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
processes.forEach(p=>{p.on('error',()=>stop(1));p.on('exit',code=>{if(!stopping)stop(code || 1);});});
