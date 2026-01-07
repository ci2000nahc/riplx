import React, { useState } from 'react';
import axios from 'axios';
import { useWalletStore } from '../store/walletStore';
import { useCrosmark } from '../hooks/useCrosmark';
import { API_BASE_URL, XRPL_CONFIG } from '../utils/xrplConfig';
import { isValidAmount } from '../utils/validators';

// Simple RLUSD -> XRP swap using OfferCreate (tfSell + IOC) signed via Crossmark.
export default function SwapForm() {
  const address = useWalletStore((state) => state.address);
  const { signTransaction } = useCrosmark();
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setTxHash(null);

    if (!address) {
      setError('Connect your wallet first');
      return;
    }

    if (!isValidAmount(amount) || !isValidAmount(price)) {
      setError('Enter valid RLUSD amount and XRP price');
      return;
    }

    const amountValue = parseFloat(amount);
    const priceValue = parseFloat(price);
    const takerGetsDrops = Math.round(amountValue * priceValue * 1_000_000);
    if (takerGetsDrops <= 0) {
      setError('Computed output is too small');
      return;
    }

    const txJson = {
      TransactionType: 'OfferCreate',
      TakerPays: {
        currency: XRPL_CONFIG.rlusdCode,
        issuer: XRPL_CONFIG.rlusdIssuer,
        value: amountValue.toString(),
      },
      TakerGets: takerGetsDrops.toString(),
      Flags: 0x000A0000, // tfImmediateOrCancel + tfSell
    };

    try {
      setLoading(true);
      const txBlob = await signTransaction(txJson);
      if (!txBlob) {
        setError('No signature received from wallet');
        return;
      }

      const submitResponse = await axios.post(`${API_BASE_URL}/api/transactions/submit`, {
        signed_tx: { tx_blob: txBlob },
      });

      const hash = submitResponse.data.tx_hash || 'pending';
      setTxHash(hash);
      setSuccess('Swap submitted (OfferCreate). If matched on-ledger, XRP will be returned and RLUSD debited.');
      setAmount('');
      setPrice('');
    } catch (err: any) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      const asString = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : undefined;
      setError(asString || err.message || 'Failed to submit swap');
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return (
      <div className="text-gray-500 text-center">
        Connect your wallet to swap RLUSD/XRP
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Swap RLUSD for XRP</h2>
      <div className="mb-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded p-3">
        Uses OfferCreate with tfImmediateOrCancel + tfSell. If no book liquidity, the offer is dropped.
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">RLUSD amount</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1.0"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (XRP per RLUSD)</label>
          <input
            type="number"
            step="0.000001"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.5"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded text-sm">{success}</div>
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

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Swap now'}
        </button>
      </form>
    </div>
  );
}
