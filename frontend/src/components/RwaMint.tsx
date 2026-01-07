import React, { useState } from 'react';
import axios from 'axios';
import { useWalletStore } from '../store/walletStore';
import { API_BASE_URL, XRPL_CONFIG } from '../utils/xrplConfig';
import { isValidAmount } from '../utils/validators';
import { useCredentialGate } from '../hooks/useCredentialGate';

export default function RwaMint() {
  const address = useWalletStore((state) => state.address);
  const { allowed, loading: gateLoading, reason } = useCredentialGate(address);
  const [tier, setTier] = useState<'accredited' | 'local'>('accredited');
  const [amount, setAmount] = useState('1');
  const [txJson, setTxJson] = useState<any>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setTxJson(null);

    if (!address) {
      setError('Connect your wallet first');
      return;
    }
    if (!allowed) {
      setError(reason || 'Not permitted to mint this RWA tier (demo gate).');
      return;
    }
    if (!isValidAmount(amount)) {
      setError('Enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      const resp = await axios.post(`${API_BASE_URL}/api/rwa/mint`, {
        address,
        tier,
        amount,
      });
      setTxJson(resp.data.tx_json);
      setSuccess(`Mint request accepted. Token code ${resp.data.token_code}. Issuer must sign & submit the tx_json.`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const asString = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : undefined;
      setError(asString || err.message || 'Mint request failed');
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return <div className="text-gray-500">Connect your wallet to mint gated RWA tokens.</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-3">Gated RWA Mint (Demo)</h2>
      <p className="text-sm text-gray-700 mb-3">
        Only credentialed users can request mint. Issuer must sign and submit the returned tx_json.
      </p>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className={`px-2 py-1 rounded ${allowed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
          {allowed ? 'Credential check: Verified (demo)' : 'Credential check: Pending/Not verified'}
        </span>
        {gateLoading && <span className="text-gray-500">Verifying…</span>}
        {reason && !allowed && <span className="text-amber-700">{reason}</span>}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as 'accredited' | 'local')}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="accredited">Accredited Investor</option>
            <option value="local">Local Resident</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-600">
          Token codes: {XRPL_CONFIG.rwaAccreditedCode} (accredited) / {XRPL_CONFIG.rwaLocalCode} (local). A trustline from the recipient to the issuer is required before settlement.
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded text-sm">{success}</div>}
        {txJson && (
          <pre className="bg-gray-900 text-green-100 text-xs p-3 rounded overflow-x-auto">
{JSON.stringify(txJson, null, 2)}
          </pre>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Preparing...' : 'Request mint (issuer signs)'}
        </button>
      </form>
    </div>
  );
}
