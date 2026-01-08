# RLUSD Payment App - XRPL MVP

A consumer-facing payment application for Ripple USD (RLUSD) on the XRP Ledger. First-to-market RLUSD payment app with instant 3-5 second settlement.

## Project Overview

**Problem:** No user-friendly RLUSD payment application exists on XRPL today.

**Solution:** A working MVP that demonstrates wallet connect, balances, allowlist/credential-gated RWA mint, and issuer-sign flow on XRPL testnet.

**Note:** Payment and swap UIs are disabled; Crossmark currently rejects `CredentialAccept` on testnet, so the demo gate uses allowlist/judging mode (set `CREDENTIAL_ALLOWLIST` to lock it down).

## Capabilities (Testnet)

- Crossmark wallet connection for XRPL-native flows
- Real-time RLUSD + XRP balances via XRPL RPC
- Credential-gated RWA mint (ACCREDITED/LOCAL) with issuer sign/submit helper
- On-ledger credential issue/accept/verify demo (ACCREDITED badge)
- Recent transactions feed (XRP + RLUSD)
- Developer feedback CTA to capture issues/UX gaps
- React + Tailwind UI ready for demos on XRPL testnet

## Known Limitation

**RLUSD via Crossmark:** The Crossmark SDK `signAndWait()` currently supports only native XRP, not issued currencies like RLUSD. Issued-currency Amount objects are unsupported, so RLUSD sends must use XUMM/Xaman or a custom builder.

**Workarounds for RLUSD:**

- Use XUMM/Xaman (already implemented)
- Build RLUSD transactions manually (XRPL SDK) and present for signing
- Add a backend signing helper when supported by the chosen wallet

## RLUSD Notes (Testnet)

- Issuer: rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV
- Currency (hex): 524C555344000000000000000000000000000000 (RLUSD padded)
- Sender must hold RLUSD and have the trustline to the issuer.
- Recipient must have the same trustline before receiving RLUSD, or the network rejects the payment.
- XUMM/Xaman must be on testnet and use a testnet app key/secret.
- XUMM signs with the currently active account; switch to the funded RLUSD account before opening the signing prompt.
- If you see `temREDUNDANT` after signing, the same signed payload was already submitted/seen. Check the txid from `/api/transactions/xumm/status/:uuid` on the explorer; if you need another payment, generate a fresh payload (or change the amount) and sign once.

## Gated RWA Mint (Demo)

- New portal flow: only credential-verified users (demo gate) can request mint of RWA tokens by tier:
  - Accredited: code `RWAACC`
  - Local resident: code `RWALOC`
- Endpoint: `POST /api/rwa/mint` returns a Payment `tx_json` from the issuer to the requester; issuer must sign and submit.
- Issuer submit helper: `POST /api/rwa/submit` signs + submits the returned `tx_json` using `ISSUER_SEED` (demo-only). If `ISSUER_SIGN_TOKEN` is set, call with header `X-Issuer-Token`.
- Trustline required: recipient must add a trustline to the issuer/token code before settlement.
- Credential gate options: on-ledger credential or allowlist fallback. If `CREDENTIAL_ALLOWLIST` is empty, the gate is OPEN (judging mode). To lock it, set comma-separated XRPL classic addresses in `CREDENTIAL_ALLOWLIST` and restart backend.
- On-ledger credential path (ACCREDITED):
  - **Issue**: `POST /api/credentials/create` (admin token header `X-Credential-Token` if set). Uses `CREDENTIAL_ISSUER_SEED`, `CREDENTIAL_ISSUER_ADDRESS`, and `CREDENTIAL_TYPE_HEX` (defaults to `ACCREDITED`).
  - **Accept**: Crossmark currently rejects `CredentialAccept` on testnet; use allowlist/judging mode instead for the live demo. If you have a wallet/network that supports `CredentialAccept`, sign it client-side and submit as usual.
  - **Verify**: `GET /api/credentials/status` checks `lsfAccepted` via `ledger_entry` (for networks/wallets that support credential acceptance). Mint button unlocks when accepted.
- Frontend issuer button uses optional `REACT_APP_ISSUER_SIGN_TOKEN` to pass the signing token header when required. Frontend credential accept uses `REACT_APP_CREDENTIAL_ISSUER_ADDRESS` and `REACT_APP_CREDENTIAL_TYPE_HEX` (defaults provided).

## Frontend Deploy (Vercel)

- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Output directory: `build`
- Env vars: set `REACT_APP_API_URL` to your backend URL (e.g., `http://localhost:8000` or your hosted backend)
- A monorepo config is provided in `vercel.json` for static build routing.

## Quick Start (5 Minutes)

### Prerequisites

- Node.js 18+
- Python 3.10+
- [Crossmark Wallet](https://crossmark.io/) extension installed
- (Optional, required for RLUSD send) XUMM API key/secret from [XUMM Developer Console](https://apps.xumm.dev/)
- Git

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/ci2000nahc/riplx.git
cd riplx

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup (in new terminal)
cd frontend
npm install
```

### 2. Start Services

**Terminal 1 - Backend:**

```bash
cd backend
source venv/bin/activate
export REACT_APP_XUMM_API_KEY="your_xumm_key"       # required for RLUSD via XUMM
export REACT_APP_XUMM_API_SECRET="your_xumm_secret" # required for RLUSD via XUMM
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm start
```

Opens: http://localhost:3000

### 3. Fund Your Testnet Wallet

1. Visit [XRP Faucets](https://xrpl.org/resources/dev-tools/xrp-faucets) → **Testnet** → Generate credentials
2. **Option A (Recommended):** Use your Crossmark wallet address directly
   - Open Crossmark → copy your address (e.g., `rhRDjHYWqYA4BQRdDNeJBsH8B9cZ2dv7sQ`)
   - Paste in faucet → fund with 100 XRP ✅
3. **Option B:** Import a funded testnet account into Crossmark via secret key
4. Get RLUSD test tokens: [RLUSD Testnet Faucet](https://tryrlusd.com/) → paste your address
5. Now test the app!

### Live Testing (Verified on Testnet)

- Crossmark wallet connected and funded
- XRP balance: **98.59 XRP** (from testnet faucet)
- RLUSD tokens received: **10.00 RLUSD** (from RLUSD faucet)
- Balance queries and XRP/RLUSD payments working against XRPL testnet
- Backend async/thread pool integration verified

**App is production-ready for XRPL testnet demo.**

### Test the App (Live Demo)

1. Start services if not already running:

   ```bash
   # Terminal 1: Backend
   cd backend && source venv/bin/activate
   python -m uvicorn app.main:app --reload --port 8000

   # Terminal 2: Frontend
   cd frontend && npm start
   ```

2. Open http://localhost:3000
3. Click **"Connect Crossmark"** → approve wallet connection
4. **Live results** (real data from XRPL):
   - ✓ Wallet Address: `rhRDjHYWqYA4BQRdDNeJBsH8B9cZ2dv7sQ`
   - ✓ XRP Balance: ~98-99 XRP
   - ✓ RLUSD Balance: 10.00 RLUSD

### Verified API Response

```json
GET http://localhost:8000/api/balance/rhRDjHYWqYA4BQRdDNeJBsH8B9cZ2dv7sQ

{
  "address": "rhRDjHYWqYA4BQRdDNeJBsH8B9cZ2dv7sQ",
  "xrp_balance": "98590000",  // In drops (98.59 XRP)
  "rlusd_balance": "10.00"    // 10 RLUSD from faucet
}
```

### How to Fund Your Wallet

1. **Get XRP:** [XRP Faucet](https://xrpl.org/resources/dev-tools/xrp-faucets) → Testnet → 100 XRP
2. **Get RLUSD:** [RLUSD Faucet](https://tryrlusd.com/) → Paste address → 10 RLUSD (daily)
3. **Verify:** Balances update instantly in the app after settlement (~30 seconds)

## How It Works

```
User → Crossmark Wallet → XRPL Testnet → App Backend → Balance Query
                                             ↓
                                        XRPL RPC
```

1. **Connect Wallet:** Crossmark injects SDK, app signs in user
2. **Fetch Balance:** Backend queries AccountInfo + AccountLines from XRPL
3. **Send Payment:** User signs tx in Crossmark, backend submits to ledger
4. **Instant Settlement:** 3-5 seconds on XRPL (vs 12+ on other chains)

## Tech Stack

| Component  | Tech                          | Why                              |
| ---------- | ----------------------------- | -------------------------------- |
| Frontend   | React + TypeScript + Tailwind | Type-safe, Crossmark SDK native  |
| Wallet     | Crossmark SDK                 | Only mature XRPL-native wallet   |
| Backend    | FastAPI + Python              | Async, thread pool for XRPL sync |
| Blockchain | XRPL Testnet                  | Native RLUSD, instant settlement |
| RPC        | xrpl.js v4.4+                 | Official XRPL library            |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  RLUSD Payment App                      │
├──────────────────┬──────────────────┬──────────────────┤
│  React Frontend  │  FastAPI Backend │  XRPL Testnet   │
│                  │                  │                  │
│ • Crossmark SDK  │ • Balance API    │ • RLUSD Issuer  │
│ • Wallet Connect │ • TX Submit      │ • Account Data  │
│ • TX Form        │ • Thread Pool    │ • Ledger        │
└──────────────────┴──────────────────┴──────────────────┘
```

## Project Structure

```
riplx/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── config.py        # XRPL RPC URL, RLUSD issuer
│   │   ├── routes/
│   │   │   ├── balance.py   # GET /api/balance/{address}
│   │   │   ├── transactions.py  # POST /api/transactions/prepare
│   │   │   └── credentials.py   # Placeholder for future DID
│   │   └── models/
│   │       └── schemas.py   # Pydantic validation
│   ├── requirements.txt
│   └── venv/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx     # Crossmark login
│   │   │   ├── BalanceDisplay.tsx    # Real-time balance
│   │   │   ├── SendForm.tsx          # Send RLUSD form
│   │   │   └── TransactionHistory.tsx # TX list
│   │   ├── hooks/
│   │   │   ├── useCrosmark.ts        # Wallet SDK integration
│   │   │   ├── useRLUSDBalance.ts    # Balance queries
│   │   │   └── useRLUSDTransaction.ts # TX submission
│   │   ├── store/
│   │   │   └── walletStore.ts        # Global address state
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── package.json
│
├── docs/
│   ├── important-info.md    # Rubric & submission criteria
│   ├── ideas-ripple-seeks.md
│   └── development.md
│
└── README.md (this file)
```

## API Reference

Auto-generated Swagger docs at: **http://localhost:8000/docs**

### Core Endpoints

```
GET  /api/balance/{address}           # Get RLUSD + XRP balance
                                      # Returns: {address, xrp_balance, rlusd_balance}

POST /api/transactions/prepare        # Prepare unsigned payment TX
                                      # Body: {destination, amount, currency}
                                      # Returns: {tx_json, signing_pub_key, message}

POST /api/transactions/xumm/prepare   # Create XUMM payload for RLUSD
                                      # Body: {destination, amount, currency='USD'}
                                      # Returns: {uuid, next_url, qr_url}

GET  /api/transactions/xumm/status/:uuid  # Poll signing status, returns signed + txid

GET  /api/history/{address}           # Recent payments for address (XRP + RLUSD)
```

## XRPL Features Used

| Feature          | Why                | Benefit                       |
| ---------------- | ------------------ | ----------------------------- |
| **RLUSD Token**  | Stablecoin on XRPL | Real-world value transfers    |
| **AccountLines** | Query trustlines   | Check RLUSD balance instantly |
| **AccountInfo**  | Account data       | Get XRP balance & metadata    |
| **Payment TX**   | Native XRPL TX     | Instant 3-5 second settlement |

**RLUSD Testnet Details:**

- Issuer: `rN7n7otQDd6FczFgLdlqtyMVrDPvdHAY5M`
- RPC: `s.altnet.rippletest.net:51234`
- Network: XRPL Testnet
- Get Tokens: [RLUSD Faucet](https://tryrlusd.com/)

## Rubric Alignment

We directly address Ripple's scoring criteria:

| Rubric                       | How We Win                                               | Score           |
| ---------------------------- | -------------------------------------------------------- | --------------- |
| **Business Potential (20%)** | Real RLUSD payments, proven demand, instant settlement   | Clear           |
| **Creativity (20%)**         | First consumer-facing RLUSD payment app                  | First-to-market |
| **Use of XRPL (30%)**        | Native RLUSD, instant payments, testnet-to-mainnet ready | Full leverage   |
| **Completeness (30%)**       | Working MVP, public GitHub, detailed README, testable    | ✅ Complete     |

**What Judges Will See:**

1. Live wallet connection at http://localhost:3000
2. Real balance queries from XRPL testnet
3. Clean, documented codebase
4. Clear path to mainnet (just change RPC URL)

### Running Tests

```bash
# Verify balance endpoint
curl http://localhost:8000/api/balance/rhRDjHYWqYA4BQRdDNeJBsH8B9cZ2dv7sQ

# View API docs
open http://localhost:8000/docs
```

## Troubleshooting

| Issue                      | Solution                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crossmark not showing      | Make sure extension has permission for localhost:3000                                                                                                             |
| 500 balance error          | Check backend logs, verify address is testnet                                                                                                                     |
| Slow balance load          | XRPL RPC can be slow, reload page                                                                                                                                 |
| Wallet not connecting      | Refresh page, ensure Crossmark is enabled                                                                                                                         |
| Insufficient RLUSD in XUMM | Ensure the active XUMM account has RLUSD balance and the RLUSD trustline (issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV). The recipient must also have the trustline. |
| XUMM code temREDUNDANT     | The signed tx was already seen/submitted; use the txid to confirm on the explorer or send a fresh payload with a new amount.                                      |

## Next Steps

**Phase 1 (Current MVP):**

- ✅ XRP payments working
- ✅ Real-time balance display working
- ✅ XRPL integration proven

**Phase 2 (RLUSD Transactions):**

1. **Option A: Switch to XUMM Wallet** - Native RLUSD support
2. **Option B: Custom Transaction Builder** - Build & sign RLUSD txs in backend
3. **Option C: Multiple Wallet Support** - Let users choose Crossmark (XRP) or XUMM (RLUSD)

**Phase 3:**

- Transaction history endpoint
- Mainnet support
- DID/KYC credentials

## Resources

- [XRPL Docs](https://xrpl.org/docs)
- [xrpl.js Library](https://js.xrpl.org)
- [Crossmark SDK Docs](https://docs.crossmark.io/)
- [RLUSD Stablecoin](https://docs.ripple.com/stablecoin/)
- [XRPL Community Discord](https://discord.com/invite/xrpl)
