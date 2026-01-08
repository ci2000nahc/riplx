from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import httpx
from datetime import datetime
from uuid import uuid4
from typing import Dict, List

from xrpl.clients import JsonRpcClient
from xrpl.transaction import safe_sign_and_submit_transaction
from xrpl.models.transactions import NFTokenMint
from xrpl.wallet import Wallet
from xrpl.models.requests import AccountNFTs
from xrpl.utils import str_to_hex

XUMM_API_KEY = os.getenv("XUMM_API_KEY")
XUMM_API_SECRET = os.getenv("XUMM_API_SECRET")
XUMM_API_BASE = "https://xumm.app/api/v1/platform"

XRPL_RPC_URL = os.getenv("XRPL_RPC_URL", "https://s.altnet.rippletest.net:51234")
XRPL_ISSUER_SEED = os.getenv("XRPL_ISSUER_SEED")
XRPL_CREDENTIAL_TAXON = int(os.getenv("XRPL_CREDENTIAL_TAXON", "1"))
XRPL_RWA_TAXON = int(os.getenv("XRPL_RWA_TAXON", "2"))

app = FastAPI(title="riplx-backend", version="0.0.1")

ISSUER_DID = os.getenv("ISSUER_DID", "did:xrpl:testnet:issuer-placeholder")

# Simple in-memory stores to keep the demo stateful without a database.
credential_store: Dict[str, List[dict]] = {}
trustlines: Dict[str, dict] = {}

# Static mock RWA catalog for demo/testing.
rwa_assets = [
    {
        "id": "rwa-condo",
        "name": "Testnet Condo",
        "description": "10% fractional condo exposure (demo)",
        "price_rlusd": "100",
        "requires_credential": "accredited",
    },
    {
        "id": "rwa-office",
        "name": "Testnet Office Space",
        "description": "Office space revenue share (demo)",
        "price_rlusd": "180",
        "requires_credential": "kyc-verified",
    },
    {
        "id": "rwa-gold",
        "name": "Testnet Gold Bar",
        "description": "Tokenized bullion (demo)",
        "price_rlusd": "250",
        "requires_credential": "accredited",
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
    uri = f"cred:{credential_type}:{subject_name or ''}:{datetime.utcnow().isoformat()}"
    minted = _mint_nft(account, uri, XRPL_CREDENTIAL_TAXON)
    return {"issued": True, "tx": minted, "credential_type": credential_type}


@app.get("/credentials/{account}")
def list_credentials(account: str):
    _ensure_account(account)
    client = _xrpl_client()
    wallet = _issuer_wallet()
    try:
        resp = client.request(AccountNFTs(account=account))
        nfts = resp.result.get("account_nfts", [])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"XRPL query failed: {exc}")
    creds = []
    for nft in nfts:
        if nft.get("Issuer") != wallet.classic_address:
            continue
        uri_hex = nft.get("URI")
        uri_text = ""
        if uri_hex:
            try:
                uri_text = bytes.fromhex(uri_hex).decode()
            except Exception:
                uri_text = ""
        creds.append({
            "nft_id": nft.get("NFTokenID"),
            "uri": uri_text,
        })
    return {"credentials": creds}


@app.get("/credentials/{account}/check")
def check_credential(account: str, credential_type: str):
    _ensure_account(account)
    has_cred = _account_has_credential(account, credential_type)
    return {"has_credential": has_cred}


@app.get("/rwa/assets")
def list_rwa_assets():
    return {"assets": rwa_assets}


@app.post("/trustlines/rlusd")
def set_trustline(account: str):
    # Trustlines require the user's signature; backend cannot set it. Return instructional response.
    _ensure_account(account)
    return {
        "trustline_set": False,
        "instruction": "User must set RLUSD trustline in wallet; backend cannot sign on behalf of user.",
    }


@app.post("/rwa/mint")
def mint_rwa(account: str, asset_id: str):
    _ensure_account(account)
    asset = next((a for a in rwa_assets if a["id"] == asset_id), None)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    required = asset.get("requires_credential")
    if required and not _account_has_credential(account, required):
        raise HTTPException(status_code=403, detail="Missing required credential")

    uri = f"rwa:{asset_id}:{datetime.utcnow().isoformat()}"
    minted = _mint_nft(account, uri, XRPL_RWA_TAXON)
    minted_token = {
        "asset_id": asset_id,
        "tx_hash": minted.get("tx_hash"),
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


def _xrpl_client():
    return JsonRpcClient(XRPL_RPC_URL)


def _issuer_wallet():
    if not XRPL_ISSUER_SEED:
        raise HTTPException(status_code=500, detail="XRPL_ISSUER_SEED not configured")
    return Wallet.from_seed(XRPL_ISSUER_SEED)


def _mint_nft(destination: str, uri_text: str, taxon: int):
    client = _xrpl_client()
    wallet = _issuer_wallet()
    tx = NFTokenMint(
        account=wallet.classic_address,
        uri=str_to_hex(uri_text),
        nftoken_taxon=taxon,
        transfer_fee=0,
        flags=8,  # tfTransferable so recipient can move it
        destination=destination,
    )
    try:
        result = safe_sign_and_submit_transaction(tx, wallet, client)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"XRPL submit failed: {exc}")
    engine = result.result.get("engine_result")
    if engine not in {"tesSUCCESS", "tecDUPLICATE"}:
        raise HTTPException(status_code=502, detail=f"XRPL engine_result {engine}")
    return {
        "tx_hash": result.result.get("tx_json", {}).get("hash"),
        "engine_result": engine,
    }


def _account_has_credential(account: str, credential_type: str):
    client = _xrpl_client()
    wallet = _issuer_wallet()
    try:
        resp = client.request(AccountNFTs(account=account))
        nfts = resp.result.get("account_nfts", [])
    except Exception:
        return False
    for nft in nfts:
        if nft.get("Issuer") != wallet.classic_address:
            continue
        uri_hex = nft.get("URI")
        if uri_hex:
            try:
                uri_text = bytes.fromhex(uri_hex).decode()
            except Exception:
                uri_text = ""
            if credential_type in uri_text:
                return True
    return False


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
