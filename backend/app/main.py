from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import httpx

XUMM_API_KEY = os.getenv("XUMM_API_KEY")
XUMM_API_SECRET = os.getenv("XUMM_API_SECRET")
XUMM_API_BASE = "https://xumm.app/api/v1/platform"

app = FastAPI(title="riplx-backend", version="0.0.1")

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


def _auth_headers():
    if not XUMM_API_KEY or not XUMM_API_SECRET:
        raise HTTPException(status_code=500, detail="XUMM API credentials not configured")
    return {
        "x-api-key": XUMM_API_KEY,
        "x-api-secret": XUMM_API_SECRET,
    }


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
