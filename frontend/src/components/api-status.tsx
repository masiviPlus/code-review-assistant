'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Status = 'loading' | 'online' | 'offline';

const POLL_INTERVAL_MS = 30_000;

const DOT_COLOR: Record<Status, string> = {
  loading: 'bg-neutral-400',
  online: 'bg-emerald-500',
  offline: 'bg-red-400',
};

const LABEL: Record<Status, string> = {
  loading: 'API: checking',
  online: 'API: online',
  offline: 'API: offline',
};

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await api<{ uptime: number }>('/api/health');
        if (mounted) setStatus(res.ok ? 'online' : 'offline');
      } catch {
        if (mounted) setStatus('offline');
      }
    }

    check();
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-300">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_COLOR[status]}`}
      />
      {LABEL[status]}
    </span>
  );
}
