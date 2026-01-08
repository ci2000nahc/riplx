import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useXumm } from './hooks/useXumm';
import './index.css';

const queryClient = new QueryClient();

function ConnectCard() {
  const { address, apiKey, isConnecting, isReady, error, loginQr, loginLink, connect, origin } = useXumm();
  const keySuffix = apiKey ? apiKey.slice(-4) : 'none';

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">XUMM / Xaman Connect</h1>
          <p className="text-sm text-slate-600">Testnet-focused minimal rebuild for wallet sign-in.</p>
        </div>
        <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
          Key suffix: {keySuffix}
        </div>
      </div>

      <div className="text-sm text-slate-600">Origin: {origin}</div>

      {address ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg">
          <div className="text-sm uppercase tracking-wide font-semibold text-emerald-700">Connected</div>
          <div className="mt-1 font-mono text-sm break-all">{address}</div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-lg space-y-3">
          <div className="font-semibold">Not connected</div>
          <p className="text-sm">Use XUMM/Xaman to scan the QR or open the deep link after hitting connect.</p>
          <button
            onClick={connect}
            disabled={isConnecting || !apiKey}
            className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isConnecting ? 'Waiting for approval…' : 'Connect with XUMM'}
          </button>
          {!apiKey && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 rounded">
              VITE_XUMM_API_KEY is not set. Add it to a .env file and restart dev server.
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded text-sm">{error}</div>
      )}

      {loginLink && (
        <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 p-3 rounded">
          <a href={loginLink} target="_blank" rel="noreferrer" className="underline font-semibold">
            Open sign-in prompt
          </a>
        </div>
      )}

      {loginQr && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm text-slate-700">Scan with XUMM / Xaman</div>
          <img src={loginQr} alt="XUMM QR" className="w-56 h-56 border rounded-lg" />
        </div>
      )}

      {!address && isReady && (
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
          <div className="font-semibold text-slate-700">If you see origin errors:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>In Xaman console: add this origin and https://*.vercel.app to Allowed Origins.</li>
            <li>Enable Web/Browser for the app key.</li>
            <li>Add your device as a sandbox test device for this app.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <ConnectCard />
        </div>
      </div>
    </QueryClientProvider>
  );
}
