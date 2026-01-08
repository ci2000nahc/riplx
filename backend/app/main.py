from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

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
