"""RWA minting (gated demo)."""

from fastapi import APIRouter, Header, HTTPException
from xrpl.clients import JsonRpcClient
from xrpl.core.addresscodec import is_valid_classic_address
from xrpl.wallet import Wallet
from app.config import settings
from app.models.schemas import (
    RwaMintRequest,
    RwaMintResponse,
    RwaSubmitRequest,
    RwaSubmitResponse,
)

router = APIRouter()
client = JsonRpcClient(settings.xrpl_rpc_url)


@router.post("/mint", response_model=RwaMintResponse)
async def mint_rwa(req: RwaMintRequest):
    """Demo RWA mint: gate by tier and return a prepared Payment tx_json for issuer-mint flow.

    Notes:
    - Demo only: we do not sign or submit on the server.
    - Requires the recipient to have a trustline to the issuer/token code.
    - Issuer must sign this tx_json (use XUMM/Xaman with issuer keys) to actually mint.
    """

    if req.tier.lower() not in {"accredited", "local"}:
        raise HTTPException(status_code=400, detail="tier must be 'accredited' or 'local'")

    if not is_valid_classic_address(req.address):
        raise HTTPException(status_code=400, detail="Destination address is not a valid XRPL classic address")

    token_code = "RWAACC" if req.tier.lower() == "accredited" else "RWALOC"

    # Prepare an issued-currency Payment from issuer to recipient (issuer must sign off-chain)
    tx_json = {
        "TransactionType": "Payment",
        "Account": settings.rlusd_issuer,  # reuse configured issuer as demo issuer
        "Destination": req.address,
        "Amount": {
            "currency": token_code,
            "issuer": settings.rlusd_issuer,
            "value": str(req.amount),
        },
    }

    return RwaMintResponse(
        accepted=True,
        token_code=token_code,
        tier=req.tier.lower(),
        message="Mint request accepted (demo). Issuer must sign and submit the tx_json.",
        tx_json=tx_json,
    )


@router.post("/submit", response_model=RwaSubmitResponse)
async def submit_rwa_tx(
    req: RwaSubmitRequest,
    x_issuer_token: str | None = Header(default=None, convert_underscores=False),
):
    """Issuer signs and submits a prepared RWA mint tx_json (demo only).

    Security: this endpoint uses ISSUER_SEED from environment. Only enable in controlled/demo environments.
    """

    if settings.issuer_sign_token:
        if x_issuer_token != settings.issuer_sign_token:
            raise HTTPException(status_code=401, detail="Invalid issuer signing token")

    if not settings.issuer_seed:
        raise HTTPException(status_code=400, detail="ISSUER_SEED not configured on server")

    tx_json = req.tx_json or {}

    if tx_json.get("TransactionType") != "Payment":
        raise HTTPException(status_code=400, detail="tx_json must be a Payment transaction")

    if tx_json.get("Account") not in {None, "", settings.rlusd_issuer}:
        raise HTTPException(status_code=400, detail="Account must be the configured issuer")

    amount = tx_json.get("Amount")
    if not isinstance(amount, dict):
        raise HTTPException(status_code=400, detail="Amount must be an issued-currency object")

    currency = amount.get("currency")
    issuer = amount.get("issuer")
    if issuer != settings.rlusd_issuer:
        raise HTTPException(status_code=400, detail="Amount issuer must match configured issuer")
    if currency not in {"RWAACC", "RWALOC"}:
        raise HTTPException(status_code=400, detail="currency must be RWAACC or RWALOC")

    destination = tx_json.get("Destination")
    if not is_valid_classic_address(destination):
        raise HTTPException(status_code=400, detail="Destination must be a valid XRPL classic address")

    # Force issuer account to match environment configuration
    tx_json["Account"] = settings.rlusd_issuer

    try:
        wallet = Wallet.from_seed(settings.issuer_seed)
        submit_req = {
            "command": "submit",
            "tx_json": tx_json,
            "secret": wallet.seed,
        }
        result = client.request(submit_req)
        engine_result = result.result.get("engine_result")
        txid = result.result.get("tx_json", {}).get("hash") or result.result.get("hash")
        submitted = engine_result in {"tesSUCCESS", "terQUEUED"}

        return RwaSubmitResponse(
            submitted=submitted,
            txid=txid,
            engine_result=engine_result,
            message="Submitted to XRPL"
            if submitted
            else f"Submission returned {engine_result or 'unknown'}",
            error=None if submitted else result.result.get("engine_result_message"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
