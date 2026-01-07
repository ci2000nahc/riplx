import { useEffect, useState } from 'react';
import axios from 'axios';
import { useWalletStore } from '../store/walletStore';
import { API_BASE_URL, XRPL_CONFIG } from '../utils/xrplConfig';

interface HistoryItem {
  hash?: string;
  transaction_type?: string;
  amount: string;
  currency: string;
  destination?: string;
  status: string;
  timestamp?: string;
}

export default function TransactionHistory() {
  const address = useWalletStore((state) => state.address);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!address) return;
      setLoading(true);
      setError(null);
      try {
        const resp = await axios.get(`${API_BASE_URL}/api/history/${address}?limit=20`);
        setTransactions(resp.data.transactions || []);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [address]);

  if (!address) {
    return (
      <div className="text-gray-500 text-center">
        Connect your wallet to view transaction history
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Recent Transactions</h2>
      {loading && (
        <p className="text-gray-600 text-center py-4">Loading history...</p>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm mb-4">
          {error}
        </div>
      )}
      {!loading && !error && transactions.length === 0 && (
        <p className="text-gray-600 text-center py-8">No transactions yet</p>
      )}
      <div className="space-y-3">
        {transactions.map((tx, index) => (
          <div key={tx.hash || index} className="bg-gray-50 p-4 rounded border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <p className="font-semibold text-gray-800">
                {tx.transaction_type || 'Transaction'}
              </p>
              <span
                className={`text-sm px-2 py-1 rounded ${
                  tx.status === 'validated'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {tx.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Amount:{' '}
              <span className="font-mono">
                {tx.amount} {tx.currency}
                {tx.currency === 'USD' ? ` (issuer ${XRPL_CONFIG.rlusdIssuer})` : ''}
              </span>
            </p>
            {tx.destination && (
              <p className="text-sm text-gray-600 mb-1">
                To: <span className="font-mono text-xs">{tx.destination}</span>
              </p>
            )}
            {tx.hash && (
              <p className="text-sm text-gray-600">
                Hash:{' '}
                <span className="font-mono text-xs break-all">{tx.hash}</span>
                <a
                  href={`${XRPL_CONFIG.explorerUrl}transactions/${tx.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-blue-600 underline text-xs"
                >
                  View
                </a>
              </p>
            )}
            {tx.timestamp && (
              <p className="text-xs text-gray-500 mt-1">{tx.timestamp}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
