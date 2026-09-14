import { useEffect, useRef, useState } from 'react';

/** Refresh snapshots without overlapping requests or updating unmounted views. */
export function useLiveData<T>(load: () => Promise<T>, interval = 2000) {
  const loader = useRef(load);
  loader.current = load;
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const result = await loader.current();
        if (active) { setData(result); setError(''); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to refresh');
      } finally {
        if (active) timer = setTimeout(refresh, interval);
      }
    }
    refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [interval]);
  return { data, error };
}
