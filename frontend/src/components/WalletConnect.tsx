import { useEffect } from 'react';
import { useXumm } from '../hooks/useXumm';
import { useWalletStore } from '../store/walletStore';

export default function WalletConnect() {
  const { address, isConnected, isLoading, connect, error, loginQr, loginLink } = useXumm();
  const { setAddress, setIsConnected } = useWalletStore();

  useEffect(() => {
    if (isConnected && address) {
      setAddress(address);
      setIsConnected(true);
    }
  }, [address, isConnected, setAddress, setIsConnected]);

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
        Connect Your Wallet (XUMM/Xaman)
      </h2>
      <p className="text-sm text-blue-700 mb-4">
        Use XUMM/Xaman mobile app or desktop to connect your XRPL testnet wallet.
      </p>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-sm mb-3">
          {error}
        </div>
      )}
      <button
        onClick={handleConnect}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Connect with XUMM/Xaman
      </button>
      {(loginLink || loginQr) && (
        <div className="mt-3 space-y-2 text-sm text-blue-900">
          {loginLink && (
            <a
              href={loginLink}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline"
            >
              Open sign-in prompt
            </a>
          )}
          {loginQr && (
            <div className="flex justify-center">
              <img src={loginQr} alt="XUMM sign-in QR" className="w-40 h-40 border" />
            </div>
          )}
          <div className="text-xs text-gray-700">
            Scan in XUMM/Xaman to approve and link this session. The connected address will appear above once signed.
          </div>
        </div>
      )}
    </div>
  );
}
