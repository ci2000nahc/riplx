import { useCrosmark } from '../hooks/useCrosmark';
import { useWalletStore } from '../store/walletStore';

export default function WalletConnect() {
  const { address, isConnected, isLoading, connect } = useCrosmark();
  const { setAddress, setIsConnected } = useWalletStore();

  const handleConnect = async () => {
    try {
      const connectedAddress = await connect();
      if (connectedAddress) {
        setAddress(connectedAddress);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  if (isLoading) {
    return <div className="text-center text-gray-600">Loading wallet...</div>;
  }

  if (isConnected && address) {
    return (
      <div className="bg-green-50 border border-green-200 rounded p-4">
        <h2 className="text-lg font-semibold text-green-900 mb-2">
          ✓ Wallet Connected
        </h2>
        <code className="text-sm text-green-700 break-all">{address}</code>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-4">
      <h2 className="text-lg font-semibold text-blue-900 mb-2">
        Connect Your Wallet
      </h2>
      <p className="text-sm text-blue-700 mb-4">
        Install{' '}
        <a
          href="https://crossmark.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Crossmark
        </a>
        {' '}browser extension to get started.
      </p>
      <button
        onClick={handleConnect}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Connect Crossmark
      </button>
    </div>
  );
}
