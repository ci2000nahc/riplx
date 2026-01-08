from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import httpx
from datetime import datetime
from uuid import uuid4
from typing import Dict, List

XUMM_API_KEY = os.getenv("XUMM_API_KEY")
XUMM_API_SECRET = os.getenv("XUMM_API_SECRET")
XUMM_API_BASE = "https://xumm.app/api/v1/platform"

app = FastAPI(title="riplx-backend", version="0.0.1")

ISSUER_DID = os.getenv("ISSUER_DID", "did:xrpl:testnet:issuer-placeholder")

# Simple in-memory stores to keep the demo stateful without a database.
credential_store: Dict[str, List[dict]] = {}
trustlines: Dict[str, dict] = {}

# Static mock RWA catalog for demo/testing.
rwa_assets = [
    {
        "id": "rwa-001",
        "name": "Testnet Commercial Note",
        "description": "A mock RWA for demo purposes",
        "price_rlusd": "100",
        "requires_credential": "accredited",
    },
    {
        "id": "rwa-002",
        "name": "Testnet Equity Warrant",
        "description": "Demo-only equity-style token",
        "price_rlusd": "250",
        "requires_credential": "kyc-verified",
    },
]

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
origins_list = [o.strip() for o in allowed_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/config/xrpl")
def xrpl_config():
    return {
        "network": os.getenv("XRPL_NETWORK", "testnet"),
        "rpc_url": os.getenv("XRPL_RPC_URL", "https://s.altnet.rippletest.net:51234"),
    }


@app.post("/did/create")
def create_did():
    did = f"did:xrpl:testnet:{uuid4()}"
    return {"did": did, "created_at": datetime.utcnow().isoformat() + "Z"}


@app.post("/credentials/issue")
def issue_credential(account: str, credential_type: str, subject_name: str | None = None):
    _ensure_account(account)
    record = _store_credential(account, credential_type, {"subject_name": subject_name} if subject_name else None)
    return {"issued": True, "credential": record}


@app.get("/credentials/{account}")
def list_credentials(account: str):
    _ensure_account(account)
    return {"credentials": credential_store.get(account, [])}


@app.get("/credentials/{account}/check")
def check_credential(account: str, credential_type: str):
    _ensure_account(account)
    creds = credential_store.get(account, [])
    has_cred = any(c.get("credential_type") == credential_type for c in creds)
    return {"has_credential": has_cred}


@app.get("/rwa/assets")
def list_rwa_assets():
    return {"assets": rwa_assets}


@app.post("/trustlines/rlusd")
def set_trustline(account: str):
    _ensure_account(account)
    trustlines[account] = {"rlusd": True, "updated_at": datetime.utcnow().isoformat() + "Z"}
    return {"trustline_set": True, "account": account}


@app.post("/rwa/mint")
def mint_rwa(account: str, asset_id: str):
    _ensure_account(account)
    asset = next((a for a in rwa_assets if a["id"] == asset_id), None)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    required = asset.get("requires_credential")
    if required and not any(c.get("credential_type") == required for c in credential_store.get(account, [])):
        raise HTTPException(status_code=403, detail="Missing required credential")
    if account not in trustlines:
        raise HTTPException(status_code=403, detail="RLUSD trustline not set")

    tx_hash = f"TESTNET-TX-{uuid4()}"
    minted_token = {
        "asset_id": asset_id,
        "token_id": f"RWA-{asset_id}-{uuid4()}",
        "tx_hash": tx_hash,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    return {"minted": True, "result": minted_token}


def _auth_headers():
    if not XUMM_API_KEY or not XUMM_API_SECRET:
        raise HTTPException(status_code=500, detail="XUMM API credentials not configured")
    return {
        "x-api-key": XUMM_API_KEY,
        "x-api-secret": XUMM_API_SECRET,
    }


def _ensure_account(account: str):
    if not account or len(account) < 10:
        raise HTTPException(status_code=400, detail="Invalid account address provided.")


def _store_credential(account: str, credential_type: str, metadata: dict | None = None):
    record = {
        "id": str(uuid4()),
        "account": account,
        "issuer_did": ISSUER_DID,
        "credential_type": credential_type,
        "issued_at": datetime.utcnow().isoformat() + "Z",
        "meta": metadata or {},
    }
    credential_store.setdefault(account, []).append(record)
    return record


@app.post("/auth/xumm/signin")
async def xumm_signin():
    payload = {"txjson": {"TransactionType": "SignIn"}}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(f"{XUMM_API_BASE}/payload", json=payload, headers=_auth_headers())
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    data = resp.json()
    return {
        "uuid": data.get("uuid"),
        "next_url": data.get("next") or data.get("refs", {}).get("qr_png"),
        "qr_url": data.get("refs", {}).get("qr_png"),
        "refs": data.get("refs", {}),
    }


@app.get("/auth/xumm/status/{uuid}")
async def xumm_status(uuid: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{XUMM_API_BASE}/payload/{uuid}", headers=_auth_headers())
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    data = resp.json()
    return {
        "signed": bool(data.get("meta", {}).get("signed")),
        "account": data.get("response", {}).get("account"),
        "txid": data.get("response", {}).get("txid"),
    }
