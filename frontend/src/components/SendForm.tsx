import React, { useEffect, useState } from 'react';
import { useWalletStore } from '../store/walletStore';
import { isValidXRPLAddress, isValidAmount } from '../utils/validators';
import { useCrosmark } from '../hooks/useCrosmark';
import axios from 'axios';
import { API_BASE_URL, XRPL_CONFIG } from '../utils/xrplConfig';
import { useCredentialGate } from '../hooks/useCredentialGate';

export default function SendForm() {
  const address = useWalletStore((state) => state.address);
  const { signTransaction } = useCrosmark();
  const { allowed: credentialAllowed, loading: credentialLoading, reason: credentialReason } = useCredentialGate(address);
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('XRP');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [xummQr, setXummQr] = useState<string | null>(null);
  const [xummLink, setXummLink] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [trustLink, setTrustLink] = useState<string | null>(null);
  const [trustQr, setTrustQr] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setToast(null);
    setTxHash(null);
    setTrustLink(null);
    setTrustQr(null);
    setXummLink(null);
    setXummQr(null);
    setLoading(true);

    try {
      // Validation
      if (!isValidXRPLAddress(destination)) {
        setError('Invalid XRPL address');
        setLoading(false);
        return;
      }

      if (!isValidAmount(amount)) {
        setError('Invalid amount');
        setLoading(false);
        return;
      }

      if (currency === 'XRP') {
        // XRP path via Crossmark
        console.log('Preparing XRP transaction...');
        const prepareResponse = await axios.post(`${API_BASE_URL}/api/transactions/prepare`, {
          destination,
          amount,
          currency: 'XRP'
        });

        const txJson = prepareResponse.data.tx_json;
        console.log('Prepared tx_json from backend:', txJson);

        console.log('Requesting Crossmark signature...');
        let txBlob;
        try {
          txBlob = await signTransaction(txJson);
        } catch (signError: any) {
          console.error('Signing error:', signError);
          if (signError.message && signError.message.includes('cancelled')) {
            setError('Transaction signing cancelled');
          } else if (signError.message && signError.message.includes('Non-base58')) {
            setError('Invalid transaction format. Please try again.');
          } else {
            setError(`Signing failed: ${signError.message}`);
          }
          setLoading(false);
          return;
        }

        if (!txBlob) {
          setError('No signature received from wallet');
          setLoading(false);
          return;
        }

        console.log('Submitting signed transaction...');
        const submitResponse = await axios.post(`${API_BASE_URL}/api/transactions/submit`, {
          signed_tx: {
            tx_blob: txBlob
          }
        });

        const hash = submitResponse.data.tx_hash || 'pending';
        setTxHash(hash);
        setSuccess('Payment submitted to XRPL testnet');
        setDestination('');
        setAmount('');
      } else {
        // RLUSD via XUMM
        if (!credentialAllowed) {
          setError(credentialReason || 'This wallet is not permissioned to send RLUSD (demo gate).');
          setToast('Not permitted to send RLUSD');
          setLoading(false);
          return;
        }

        const trustlineCheck = await axios.post(`${API_BASE_URL}/api/transactions/validate-recipient`, {
          destination,
          currency: 'USD'
        });

        if (!trustlineCheck.data.has_trustline) {
          const reason = trustlineCheck.data.reason || 'Recipient lacks RLUSD trustline to the issuer.';
          setError(`${reason} Ask the recipient to add the trustline (issuer ${XRPL_CONFIG.rlusdIssuer}) before sending.`);
          setToast('Recipient missing RLUSD trustline.');
          setLoading(false);
          return;
        }

        console.log('Preparing RLUSD transaction via XUMM...');
        const prepareResponse = await axios.post(`${API_BASE_URL}/api/transactions/xumm/prepare`, {
          destination,
          amount,
          currency: 'USD'
        });

        const { uuid, next_url, qr_url } = prepareResponse.data;
        setXummLink(next_url || null);
        setXummQr(qr_url || null);
        setSuccess('Open the XUMM prompt to sign. This window will poll for confirmation.');

        if (next_url) {
          window.open(next_url, '_blank');
        }

        // Poll status until signed or timeout (extend window for slow approvals)
        const maxAttempts = 60; // ~180s at 3s interval
        let attempts = 0;
        while (attempts < maxAttempts) {
          const statusResponse = await axios.get(`${API_BASE_URL}/api/transactions/xumm/status/${uuid}`);
          const status = statusResponse.data;
          if (status.signed) {
            setTxHash(status.txid || 'pending');
            setSuccess('RLUSD payment signed and submitted');
            setDestination('');
            setAmount('');
            break;
          }
          attempts += 1;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        if (attempts >= maxAttempts) {
          setError('Timed out waiting for XUMM signature.');
        }
      }
    } catch (err: any) {
      console.error('Error:', err);
      const detail = err?.response?.data?.detail;
      const asString = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : undefined;
      setError(asString || err.message || 'Failed to send payment');
      setToast('Payment failed. See details above.');
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return (
      <div className="text-gray-500 text-center">
        Connect your wallet to send payments
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Send Payment</h2>
      <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
        Testnet only. RLUSD issuer: {XRPL_CONFIG.rlusdIssuer}
      </div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className={`px-2 py-1 rounded ${credentialAllowed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
          {credentialAllowed ? 'Credential check: Verified (demo)' : 'Credential check: Pending/Not verified'}
        </span>
        {credentialLoading && <span className="text-gray-500">Verifying…</span>}
        {credentialReason && !credentialAllowed && (
          <span className="text-amber-700">{credentialReason}</span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="XRP">XRP (Crossmark)</option>
            <option value="USD">RLUSD (XUMM)</option>
          </select>
          {currency === 'USD' && (
            <p className="mt-2 text-xs text-gray-600">
              RLUSD issuer: {XRPL_CONFIG.rlusdIssuer}
            </p>
          )}
        </div>

        <div>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="rN7n7otQDd6FczFgLdlqtyMVrDPvdHAY5M"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount ({currency})
          </label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded text-sm">
            {success}
          </div>
        )}

        {txHash && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded text-sm flex flex-col gap-1">
            <span className="font-semibold">Transaction Hash</span>
            <span className="font-mono text-xs break-all">{txHash}</span>
            <a
              href={`${XRPL_CONFIG.explorerUrl}transactions/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline text-xs"
            >
              View on XRPL Testnet Explorer
            </a>
          </div>
        )}

        {xummLink && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded text-sm">
            RLUSD via XUMM: <a href={xummLink} target="_blank" rel="noreferrer" className="underline">Open signing prompt</a>
          </div>
        )}

        {xummQr && (
          <div className="flex justify-center">
            <img src={xummQr} alt="XUMM QR" className="w-48 h-48 border" />
          </div>
        )}

        {currency === 'USD' && (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 p-3 rounded text-sm">
            <p className="font-semibold">Need the RLUSD trustline?</p>
            <p className="text-xs text-gray-600 mb-2">
              Open XUMM/Xaman and accept the trustline; issuer is {XRPL_CONFIG.rlusdIssuer} (RLUSD).
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  const resp = await axios.post(`${API_BASE_URL}/api/transactions/xumm/trustline`);
                  const { next_url, qr_url } = resp.data;
                  setTrustLink(next_url || null);
                  setTrustQr(qr_url || null);
                  if (next_url) window.open(next_url, '_blank');
                } catch (err: any) {
                  const detail = err?.response?.data?.detail;
                  const asString = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : undefined;
                  setError(asString || err.message || 'Failed to create trustline payload');
                }
              }}
              className="inline-block bg-indigo-600 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-indigo-700"
            >
              Add RLUSD trustline in XUMM/Xaman
            </button>

            {trustLink && (
              <div className="mt-2 text-xs">
                <a href={trustLink} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                  Open trustline prompt
                </a>
              </div>
            )}
            {trustQr && (
              <div className="mt-2 flex justify-center">
                <img src={trustQr} alt="XUMM trustline QR" className="w-40 h-40 border" />
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Send Payment'}
        </button>
      </form>

      {toast && (
        <div className="mt-4 fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}
    </div>
  );
}
