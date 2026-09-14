import React,{useEffect,useState} from 'react';
export default function AuthGate({children}:{children:React.ReactNode}) {
  const [state,setState]=useState<{authenticated:boolean;needsSetup:boolean}>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/auth').then(r=>r.json()).then(setState).catch(()=>setError('Unable to connect to the dashboard'));},[]);
  if(state?.authenticated) return <>{children}</>;
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');
    const password=new FormData(e.currentTarget).get('password');
    try { const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const data=await r.json();if(!r.ok) throw new Error(data.error);setState({authenticated:true,needsSetup:false}); }
    catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-sm space-y-4"><h1 className="text-2xl">Agent Office Dashboard</h1><h2>{!state?'Connecting...':state.needsSetup?'Set up your administrator password':'Sign in'}</h2>{state && <><label className="block">Password<input name="password" type="password" minLength={12} maxLength={256} required autoComplete={state.needsSetup?'new-password':'current-password'} className="input-dark w-full" /></label><p className="text-slate-400 text-sm">Use at least 12 characters.</p><button disabled={busy} className="bg-blue-600 rounded px-4 py-2">{busy?'Please wait...':state.needsSetup?'Create administrator':'Sign in'}</button></>}{error && <p role="alert" className="text-red-400">{error}</p>}</form></main>;
}
