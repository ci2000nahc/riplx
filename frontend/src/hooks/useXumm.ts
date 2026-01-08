import { useEffect, useMemo, useState } from 'react';
import { Xumm } from 'xumm';

type ConnectState = {
  address: string | null;
  isConnecting: boolean;
  isReady: boolean;
  error: string | null;
  loginQr: string | null;
  loginLink: string | null;
  origin: string;
  isXApp: boolean;
};

export function useXumm() {
  const apiKey = import.meta.env.VITE_XUMM_API_KEY as string | undefined;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  const [state, setState] = useState<ConnectState>({
    address: null,
    isConnecting: false,
    isReady: false,
    error: null,
    loginQr: null,
    loginLink: null,
    origin,
    isXApp: false,
  });

  const xumm = useMemo(() => {
    if (typeof window === 'undefined') return null;
    if (!apiKey) return null;
    const client = new Xumm(apiKey);
    (window as any)._xummClient = client;
    (window as any)._xummApiKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
    return client;
  }, [apiKey]);

  useEffect(() => {
    if (!xumm) {
      setState((s) => ({
        ...s,
        error: apiKey ? 'XUMM SDK unavailable in this context.' : 'VITE_XUMM_API_KEY is not set.',
        isReady: false,
      }));
      return undefined;
    }

    const onUnhandledRejection = (evt: PromiseRejectionEvent) => {
      const msg = typeof evt.reason === 'string' ? evt.reason : evt.reason?.message;
      if (msg === 'false' || msg?.includes('getSiteMeta')) {
        setState((s) => ({
          ...s,
          error: `XUMM rejected this origin (${origin}). Add it to Allowed Origins for this API key and enable Web/Browser.`,
          isConnecting: false,
        }));
      }
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);

    const onReady = () => {
      setState((s) => ({ ...s, isReady: true, error: null }));
      xumm.user.account
        .then((acct) => {
          if (acct) {
            setState((s) => ({ ...s, address: acct }));
          }
        })
        .catch(() => {
          setState((s) => ({ ...s, error: 'XUMM session not found. Please connect.' }));
        });

      xumm.environment.xapp
        .then((flag) => {
          setState((s) => ({ ...s, isXApp: Boolean(flag) }));
        })
        .catch(() => {
          // ignore
        });
    };

    xumm.on('ready', onReady);

    return () => {
      try {
        xumm.off('ready', onReady);
      } catch {
        // ignore
      }
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [apiKey, origin, xumm]);

  const connect = async () => {
    if (!xumm) {
      const msg = apiKey ? 'XUMM SDK not ready.' : 'VITE_XUMM_API_KEY is missing.';
      setState((s) => ({ ...s, error: msg }));
      throw new Error(msg);
    }

    if (!xumm.payload) {
      const msg = 'XUMM payload API unavailable.';
      setState((s) => ({ ...s, error: msg }));
      throw new Error(msg);
    }

    setState((s) => ({ ...s, isConnecting: true, error: null, loginQr: null, loginLink: null }));

    try {
      // If running inside Xaman/xApp, the user is already in-app; no QR needed.
      const insideXApp = await xumm.environment.xapp.catch(() => false);
      if (insideXApp) {
        const acct = await xumm.user.account.catch(() => null);
        if (!acct) {
          throw new Error('Inside xApp but no account returned. Check test device allowlist.');
        }
        setState((s) => ({ ...s, isXApp: true, address: acct, isConnecting: false, error: null }));
        return acct;
      }

      const subscription = await xumm.payload.createAndSubscribe(
        {
          txjson: { TransactionType: 'SignIn' },
        },
        (event) => {
          if (event.data.signed === false) return false;
          return !!event.data.signed;
        }
      );

      const created = await subscription.created;
      console.log('XUMM payload created', created);
      const refs = (created as any)?.refs as { qr_png?: string } | undefined;
      const next = (created as any)?.next as { always?: string; no_redirect?: string } | undefined;
      if (!refs?.qr_png && !next?.always && !next?.no_redirect) {
        setState((s) => ({
          ...s,
          isConnecting: false,
          error: 'XUMM payload returned no QR/deeplink. Check API key type and Allowed Origins.',
        }));
        throw new Error('XUMM payload returned no QR/deeplink');
      }
      setState((s) => ({
        ...s,
        loginQr: refs?.qr_png || null,
        loginLink: next?.always || next?.no_redirect || null,
      }));

      const resolved = await subscription.resolved;
      console.log('XUMM payload resolved', resolved);
      const response = (resolved as any)?.response;
      const acct = response?.account as string | undefined;
      const signed = Boolean(response?.signed);

      if (!signed) {
        throw new Error('User rejected or payload expired.');
      }
      if (!acct) {
        throw new Error('No account returned from XUMM.');
      }

      setState((s) => ({
        ...s,
        address: acct,
        isConnecting: false,
        error: null,
      }));
      return acct;
    } catch (err: any) {
      const status = err?.status || err?.code || err?.response?.status;
      const apiMsg = err?.body?.error?.message || err?.response?.data?.message;
      const ref = err?.body?.error?.reference;
      const msg = apiMsg || err?.message || 'Failed to connect via XUMM.';
      const suffix = ref ? ` [ref ${ref}]` : status ? ` (status ${status})` : '';
      console.error('XUMM connect failed:', err);
      setState((s) => ({ ...s, error: `${msg}${suffix}`, isConnecting: false }));
      throw err;
    }
  };

  return {
    ...state,
    apiKey,
    connect,
  };
}
