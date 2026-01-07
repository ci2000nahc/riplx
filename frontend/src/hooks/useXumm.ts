import { useEffect, useMemo, useState } from 'react';
import { Xumm } from 'xumm';

interface SignResult {
  signed: boolean;
  txid: string | null;
  nextUrl?: string | null;
  qrUrl?: string | null;
  error?: string;
}

export function useXumm() {
  const apiKey = process.env.REACT_APP_XUMM_API_KEY;
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginQr, setLoginQr] = useState<string | null>(null);
  const [loginLink, setLoginLink] = useState<string | null>(null);

  const xumm = useMemo(() => {
    if (!apiKey) {
      console.warn('XUMM_API_KEY missing; set REACT_APP_XUMM_API_KEY.');
      return null;
    }
    return new Xumm(apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (!xumm) return undefined;

    const handleReady = () => {
      xumm.user.account
        .then((acct) => {
          if (acct) {
            setAddress(acct);
            setIsConnected(true);
          }
        })
        .catch(() => undefined);
    };

    xumm.on('ready', handleReady);
    return () => {
      try {
        xumm.off('ready', handleReady);
      } catch {
        // ignore cleanup errors
      }
    };
  }, [xumm]);

  const connect = async () => {
    if (!xumm) {
      const msg = 'XUMM is not configured. Set REACT_APP_XUMM_API_KEY.';
      setError(msg);
      throw new Error(msg);
    }

    const payloadApi = xumm.payload;
    if (!payloadApi) {
      const msg = 'XUMM payload API unavailable.';
      setError(msg);
      throw new Error(msg);
    }

    try {
      setIsLoading(true);
      setError(null);
      setLoginQr(null);
      setLoginLink(null);

      // Build a SignIn payload so XUMM/Xaman shows a QR that links the session
      const subscription = await payloadApi.createAndSubscribe(
        {
          txjson: { TransactionType: 'SignIn' },
        },
        (event) => {
          // Continue listening until signed; stop if explicitly rejected
          if (event.data.signed === false) {
            return false;
          }
          return !!event.data.signed;
        }
      );

      const created = await subscription.created;
      const next = (created as any)?.next as { always?: string; no_redirect?: string } | undefined;
      setLoginQr(created?.refs?.qr_png || null);
      setLoginLink(next?.always || next?.no_redirect || null);

      // Wait for the user to sign; resolved contains account info
      const resolved = await subscription.resolved;
      const acct = (resolved as any)?.response?.account as string | undefined;
      const signed = Boolean((resolved as any)?.data?.signed ?? (resolved as any)?.response?.signed);

      if (!signed) {
        throw new Error('User rejected or login expired.');
      }
      if (!acct) {
        throw new Error('No account returned from XUMM.');
      }

      setAddress(acct);
      setIsConnected(true);
      return acct;
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect via XUMM.';
      setError(msg);
      setIsConnected(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signAndSubmit = async (txJson: any): Promise<SignResult> => {
    if (!xumm) {
      return { signed: false, txid: null, error: 'XUMM not configured.' };
    }

    const payloadApi = xumm.payload;
    if (!payloadApi) {
      return { signed: false, txid: null, error: 'XUMM payload API unavailable.' };
    }

    try {
      const subscription = await payloadApi.createAndSubscribe(
        {
          txjson: txJson,
          options: {
            submit: true,
          },
        },
        (event) => {
          if (event.data.signed === false) {
            return false;
          }
          return true;
        }
      );

      const created = await subscription.created;
      const resolved = await subscription.resolved;
      const resolvedAny = resolved as any;
      const txid = resolvedAny?.response?.txid || resolvedAny?.response?.hash || null;
      const signed = Boolean(resolvedAny?.response?.txid || resolvedAny?.response?.hash);

      const next = (created as any)?.next as { always?: string; no_redirect?: string } | undefined;

      return {
        signed,
        txid,
        nextUrl: next?.always || next?.no_redirect || null,
        qrUrl: created?.refs?.qr_png || null,
        error: signed ? undefined : 'User rejected or payload expired.',
      };
    } catch (err: any) {
      const msg = err?.message || 'XUMM signing failed.';
      return { signed: false, txid: null, error: msg };
    }
  };

  return {
    address,
    isConnected,
    isLoading,
    error,
    connect,
    signAndSubmit,
    loginQr,
    loginLink,
  };
}
