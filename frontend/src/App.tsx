import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useXumm } from './hooks/useXumm';
import './index.css';

const queryClient = new QueryClient();

function ConnectCard() {
  const { address, apiKey, isConnecting, isReady, error, loginQr, loginLink, connect } = useXumm();
  const keySuffix = apiKey ? apiKey.slice(-4) : 'none';
  const apiBase = useMemo(() => (import.meta.env.VITE_API_BASE_URL as string | undefined) || '', []);

  const [assets, setAssets] = useState<{ id: string; name: string; description: string; price_rlusd: string; requires_credential?: string }[]>([]);
  const [hasAccredited, setHasAccredited] = useState(false);
  const [hasKyc, setHasKyc] = useState(false);
  const [trustlineReady, setTrustlineReady] = useState(false);
  const [issuerTarget, setIssuerTarget] = useState('');
  const [kycForm, setKycForm] = useState({ name: '', email: '', idNumber: '' });
  const [messages, setMessages] = useState<{ id: string; text: string; tone?: 'success' | 'error' }[]>([]);

  const toast = (text: string, tone: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setMessages((m) => [...m, { id, text, tone }]);
    setTimeout(() => setMessages((m) => m.filter((t) => t.id !== id)), 5000);
  };

  const guardApi = () => {
    if (!apiBase) {
      toast('Backend API base is not set (VITE_API_BASE_URL).', 'error');
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!guardApi()) return;
    axios
      .get(`${apiBase}/rwa/assets`)
      .then((res) => setAssets(res.data?.assets || []))
      .catch(() => toast('Failed to load assets.', 'error'));
  }, [apiBase]);

  useEffect(() => {
    if (!address || !guardApi()) return;
    setIssuerTarget(address);
    axios
      .get(`${apiBase}/credentials/${address}/check`, { params: { credential_type: 'accredited' } })
      .then((res) => setHasAccredited(Boolean(res.data?.has_credential)))
      .catch(() => setHasAccredited(false));
    axios
      .get(`${apiBase}/credentials/${address}/check`, { params: { credential_type: 'kyc-verified' } })
      .then((res) => setHasKyc(Boolean(res.data?.has_credential)))
      .catch(() => setHasKyc(false));
  }, [address, apiBase]);

  const issueCredential = async (credentialType: string, targetAccount?: string) => {
    const acct = targetAccount?.trim() || issuerTarget.trim() || address;
    if (!acct) return toast('Provide a target account to issue a credential.', 'error');
    if (!guardApi()) return;
    try {
      const resp = await axios.post(`${apiBase}/credentials/issue`, null, {
        params: { account: acct, credential_type: credentialType, subject_name: kycForm.name || undefined },
      });
      toast(`Issued ${credentialType} credential to ${acct}`);
      if (acct === address) {
        setHasAccredited((v) => v || credentialType === 'accredited');
        setHasKyc((v) => v || credentialType === 'kyc-verified');
      }
      return resp.data;
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to issue credential';
      toast(msg, 'error');
    }
  };

  const setTrustline = async () => {
    if (!address) return toast('Connect wallet first.', 'error');
    if (!guardApi()) return;
    try {
      await axios.post(`${apiBase}/trustlines/rlusd`, null, { params: { account: address } });
      setTrustlineReady(true);
      toast('RLUSD trustline set (simulated).');
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Failed to set trustline', 'error');
    }
  };

  const mintAsset = async (assetId: string) => {
    if (!address) return toast('Connect wallet first.', 'error');
    if (!guardApi()) return;
    try {
      const resp = await axios.post(`${apiBase}/rwa/mint`, null, { params: { account: address, asset_id: assetId } });
      const tx = resp.data?.result?.tx_hash;
      toast(`Minted ${assetId}${tx ? ` (tx ${tx})` : ''}`);
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Mint failed', 'error');
    }
  };

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

      {loginQr && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm text-slate-700">Scan with XUMM / Xaman</div>
          <img src={loginQr} alt="XUMM QR" className="w-56 h-56 border rounded-lg" />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="font-semibold text-slate-800">Issuer dashboard</div>
          <input
            value={issuerTarget}
            onChange={(e) => setIssuerTarget(e.target.value)}
            placeholder="Target account (r...)"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => issueCredential('accredited')}
              className="bg-emerald-600 text-white px-3 py-2 rounded hover:bg-emerald-700"
            >
              Issue Accredited
            </button>
            <button
              onClick={() => issueCredential('kyc-verified')}
              className="bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700"
            >
              Issue KYC-Verified
            </button>
          </div>
          <div className="text-xs text-slate-600">Issues credentials to the target account (simulated).</div>
        </div>

        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="font-semibold text-slate-800">Mock KYC intake</div>
          <input
            value={kycForm.name}
            onChange={(e) => setKycForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            value={kycForm.email}
            onChange={(e) => setKycForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            value={kycForm.idNumber}
            onChange={(e) => setKycForm((f) => ({ ...f, idNumber: e.target.value }))}
            placeholder="ID number"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={() => issueCredential('kyc-verified')}
            className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
          >
            Submit & issue KYC credential
          </button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-800">Credential & trustline status</div>
          <div className="flex gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${hasAccredited ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
              Accredited {hasAccredited ? '✓' : ''}
            </span>
            <span className={`px-2 py-1 rounded ${hasKyc ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
              KYC {hasKyc ? '✓' : ''}
            </span>
            <span className={`px-2 py-1 rounded ${trustlineReady ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
              RLUSD trustline {trustlineReady ? '✓' : ''}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={setTrustline}
            className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
          >
            Set RLUSD trustline
          </button>
          <button
            onClick={() => {
              if (!address) return;
              axios
                .get(`${apiBase}/credentials/${address}/check`, { params: { credential_type: 'accredited' } })
                .then((res) => setHasAccredited(Boolean(res.data?.has_credential)));
              axios
                .get(`${apiBase}/credentials/${address}/check`, { params: { credential_type: 'kyc-verified' } })
                .then((res) => setHasKyc(Boolean(res.data?.has_credential)));
            }}
            className="bg-slate-100 text-slate-800 px-3 py-2 rounded text-sm"
          >
            Refresh status
          </button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="font-semibold text-slate-800">RWA minting (gated)</div>
        <div className="grid md:grid-cols-2 gap-3">
          {assets.map((asset) => {
            const credentialNeeded = asset.requires_credential;
            const hasRequired = credentialNeeded === 'accredited' ? hasAccredited : credentialNeeded === 'kyc-verified' ? hasKyc : true;
            const blocked = !hasRequired || !trustlineReady;
            return (
              <div key={asset.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="font-semibold text-slate-800">{asset.name}</div>
                <div className="text-sm text-slate-600">{asset.description}</div>
                <div className="text-sm text-slate-700">Price: {asset.price_rlusd} RLUSD</div>
                {credentialNeeded && (
                  <div className="text-xs text-slate-500">Requires: {credentialNeeded}</div>
                )}
                <button
                  onClick={() => mintAsset(asset.id)}
                  disabled={blocked}
                  className="bg-emerald-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
                >
                  {blocked ? 'Locked until credential + trustline' : 'Mint'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`text-sm px-3 py-2 rounded border ${m.tone === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}
            >
              {m.text}
            </div>
          ))}
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
