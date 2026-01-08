import { useEffect, useState } from 'react';
import axios from 'axios';

type ConnectState = {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  loginQr: string | null;
  loginLink: string | null;
  polling: boolean;
};

export function useXumm() {
  const apiKey = import.meta.env.VITE_XUMM_API_KEY as string | undefined;
  const apiBaseRaw = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
  const apiBase = apiBaseRaw.replace(/\/+$/, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  const [state, setState] = useState<ConnectState>({
    address: null,
    isConnecting: false,
    error: null,
    loginQr: null,
    loginLink: null,
    polling: false,
  });

  useEffect(() => {
    // expose key suffix for debugging
    if (typeof window !== 'undefined' && apiKey) {
      (window as any)._xummApiKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
    }
  }, [apiKey, origin]);

  const connect = async () => {
    if (!apiBase) {
      const msg = 'API base URL not set (VITE_API_BASE_URL).';
      setState((s) => ({ ...s, error: msg }));
      throw new Error(msg);
    }
    if (apiBase === origin) {
      const msg = 'VITE_API_BASE_URL points to this frontend. Set it to your backend base URL.';
      setState((s) => ({ ...s, error: msg }));
      throw new Error(msg);
    }
    if (!apiKey) {
      const msg = 'VITE_XUMM_API_KEY is missing.';
      setState((s) => ({ ...s, error: msg }));
      throw new Error(msg);
    }

    setState((s) => ({ ...s, isConnecting: true, error: null, loginQr: null, loginLink: null }));

    try {
      // Server-side payload creation
      const create = await axios.post(`${apiBase}/auth/xumm/signin`);
      const { uuid, next_url, qr_url } = create.data || {};
      if (!uuid || (!next_url && !qr_url)) {
        throw new Error('Backend returned no QR/deeplink. Check XUMM API key/server config.');
      }
      setState((s) => ({
        ...s,
        loginQr: qr_url || null,
        loginLink: next_url || null,
        polling: true,
      }));

      // Poll status
      const maxAttempts = 40; // ~2 minutes at 3s
      let attempts = 0;
      let account: string | null = null;
      while (attempts < maxAttempts) {
        const statusResp = await axios.get(`${apiBase}/auth/xumm/status/${uuid}`);
        const { signed, account: acct, txid } = statusResp.data || {};
        if (signed && acct) {
          account = acct;
          setState((s) => ({
            ...s,
            address: acct,
            isConnecting: false,
            polling: false,
            error: null,
          }));
          return acct;
        }
        attempts += 1;
        await new Promise((res) => setTimeout(res, 3000));
      }

      throw new Error('Timed out waiting for XUMM signature.');
    } catch (err: any) {
      const status = err?.status || err?.code || err?.response?.status;
      const apiMsg = err?.body?.error?.message || err?.response?.data?.message;
      const ref = err?.body?.error?.reference;
      const msg = apiMsg || err?.message || 'Failed to connect via XUMM.';
      const suffix = ref ? ` [ref ${ref}]` : status ? ` (status ${status})` : '';
      console.error('XUMM connect failed:', err);
      setState((s) => ({ ...s, error: `${msg}${suffix}`, isConnecting: false, polling: false }));
      throw err;
    }
  };

  return {
    ...state,
    apiKey,
    connect,
  };
}
