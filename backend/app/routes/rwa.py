"""RWA minting (gated demo)."""

from datetime import datetime, timedelta

import aiohttp
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from xrpl.asyncio import transaction as xrpl_tx
from xrpl.asyncio.clients import AsyncJsonRpcClient
from xrpl.core.addresscodec import is_valid_classic_address
from xrpl.models.amounts import IssuedCurrencyAmount
from xrpl.models.transactions import Payment
from xrpl.wallet import Wallet
from app.config import settings
from app.models.schemas import (
    RwaMintRequest,
    RwaMintResponse,
    RwaSubmitRequest,
    RwaSubmitResponse,
)

router = APIRouter()
async_client = AsyncJsonRpcClient(settings.xrpl_rpc_url)


def _ripple_epoch_to_iso(epoch_seconds: int | None) -> str | None:
    """Convert XRPL epoch seconds (since 2000-01-01) to ISO8601."""
    if epoch_seconds is None:
        return None
    return (datetime(2000, 1, 1) + timedelta(seconds=epoch_seconds)).isoformat() + "Z"


class RwaTrustlineRequest(BaseModel):
    code: str = "RWAACC"
    limit: str = "10"


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

    def _encode_currency(code: str) -> str:
        # XRPL non-ISO codes must be 160-bit hex; pad ASCII code
        if len(code) == 3:
            return code
        return code.encode("ascii").hex().ljust(40, "0").upper()

    try:
        wallet = Wallet.from_seed(settings.issuer_seed)
        issued_amount = IssuedCurrencyAmount(
            currency=_encode_currency(currency),
            issuer=settings.rlusd_issuer,
            value=str(amount.get("value")),
        )
        payment = Payment(account=settings.rlusd_issuer, destination=destination, amount=issued_amount)

        # Sign and submit using async client to avoid nested event loop issues
        result = await xrpl_tx.sign_and_submit(payment, async_client, wallet, autofill=True)
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


@router.post("/trustline")
async def prepare_rwa_trustline(req: RwaTrustlineRequest):
    """Create a XUMM payload to add the RWA trustline via QR (RWAACC or RWALOC)."""

    if not settings.xumm_api_key or not settings.xumm_api_secret:
        raise HTTPException(
            status_code=500,
            detail="Missing XUMM_API_KEY or XUMM_API_SECRET. Set them in the environment to enable trustlines.",
        )

    code = req.code
    limit = req.limit

    if code not in {"RWAACC", "RWALOC"}:
        raise HTTPException(status_code=400, detail="code must be RWAACC or RWALOC")

    def _encode_currency(code_str: str) -> str:
        if len(code_str) == 3:
            return code_str
        return code_str.encode("ascii").hex().ljust(40, "0").upper()

    currency_hex = _encode_currency(code)

    tx_json = {
        "TransactionType": "TrustSet",
        "LimitAmount": {
            "currency": currency_hex,
            "issuer": settings.rlusd_issuer,
            "value": limit,
        },
    }

    payload_request = {
        "txjson": tx_json,
        "options": {
            "submit": True,
        },
    }

    headers = {
        "X-API-Key": settings.xumm_api_key,
        "X-API-Secret": settings.xumm_api_secret,
        "Content-Type": "application/json",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://xumm.app/api/v1/platform/payload",
                json=payload_request,
                headers=headers,
            ) as resp:
                data = await resp.json()
                if resp.status >= 300:
                    raise HTTPException(status_code=resp.status, detail=data)

        return {
            "uuid": data.get("uuid"),
            "next_url": data.get("next", {}).get("always")
            or data.get("next", {}).get("no_redirect"),
            "qr_url": data.get("refs", {}).get("qr_png"),
            "expires_at": _ripple_epoch_to_iso(data.get("expires_at")),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
