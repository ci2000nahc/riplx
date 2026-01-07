import { useWalletStore } from '../store/walletStore';
import { useRLUSDBalance } from '../hooks/useRLUSDBalance';
import { dropsToXRP } from '../utils/validators';

export default function BalanceDisplay() {
  const address = useWalletStore((state) => state.address);
  const { data: balance, isLoading, error } = useRLUSDBalance(address);

  if (!address) {
    return (
      <div className="text-gray-500 text-center">
        Connect your wallet to view balance
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center text-gray-600">Loading balance...</div>;
  }

  if (error) {
    return (
      <div className="text-red-600">
        Error loading balance: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Your Balance</h2>
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded">
          <p className="text-gray-600 text-sm mb-1">RLUSD</p>
          <p className="text-3xl font-bold text-blue-600">
            ${balance?.rlusd_balance || '0'}
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <p className="text-gray-600 text-sm mb-1">XRP</p>
          <p className="text-xl font-semibold">
            {balance ? dropsToXRP(balance.xrp_balance) : '0'} XRP
          </p>
        </div>
      </div>
    </div>
  );
}
