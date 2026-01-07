export const XRPL_CONFIG = {
  network: process.env.REACT_APP_XRPL_NETWORK || 'testnet',
  rpcUrl: 'https://s.altnet.rippletest.net:51234', // Testnet
  wsUrl: 'wss://s.altnet.rippletest.net:51233', // WebSocket
  explorerUrl: 'https://testnet.xrpl.org/',
  // Must match backend settings.rlusd_issuer for RLUSD trustlines/payments
  rlusdIssuer: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV',
  // Use 160-bit hex currency code (matches backend settings.rlusd_code)
  rlusdCode: '524C555344000000000000000000000000000000',
  rwaAccreditedCode: 'RWAACC',
  rwaLocalCode: 'RWALOC',
  credentialIssuerAddress: process.env.REACT_APP_CREDENTIAL_ISSUER_ADDRESS || 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV',
  credentialTypeHex: process.env.REACT_APP_CREDENTIAL_TYPE_HEX || '41434352454449544544', // "ACCREDITED"
};

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
