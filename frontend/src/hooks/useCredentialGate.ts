import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/xrplConfig';

export function useCredentialGate(address: string | null) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [allowlistHit, setAllowlistHit] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!address) {
      setAllowed(false);
      setReason(null);
      setAllowlistHit(false);
      setAccepted(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const resp = await axios.get(`${API_BASE_URL}/api/credentials/verify`, {
          params: { address }
        });
        if (cancelled) return;
        setAllowed(Boolean(resp.data.allowed));
        setReason(resp.data.reason || null);
        setAllowlistHit(Boolean(resp.data.allowlist_hit));
        setAccepted(Boolean(resp.data.accepted));
      } catch (err: any) {
        if (cancelled) return;
        setAllowed(false);
        const detail = err?.response?.data?.detail;
        const asString = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : undefined;
        setReason(asString || err.message || 'Unable to verify permissions');
        setAllowlistHit(false);
        setAccepted(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [address, refreshTick]);

  const refresh = () => setRefreshTick((v) => v + 1);

  return { allowed, accepted, loading, reason, allowlistHit, refresh };
}
