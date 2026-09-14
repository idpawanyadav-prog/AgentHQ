import {onDashboardChange} from './socket-client';
import { useEffect, useRef, useState } from 'react';

/** Refresh snapshots without overlapping requests or updating unmounted views. */
export function useLiveData<T>(load: () => Promise<T>, interval = 2000) {
  const loader = useRef(load);
  loader.current = load;
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let pending=false;
    let again=false;
    async function refresh() {
      if(pending) {again=true;return;}
      pending=true;
      try {
        const result = await loader.current();
        if (active) { setData(result); setError(''); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to refresh');
      } finally {
        pending=false;
        if(active && again) {again=false;void refresh();}
      }
    }
    const unsubscribe=onDashboardChange(refresh);
    refresh();
    return () => { active = false; unsubscribe(); };
  }, [interval]);
  return { data, error };
}
