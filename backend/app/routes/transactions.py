"""Transaction endpoints"""

import asyncio
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from xrpl.clients import JsonRpcClient
from xrpl.models.requests import Tx, SubmitOnly, AccountInfo, AccountLines
from xrpl.models.transactions import Payment, TrustSet
from xrpl.core.addresscodec import is_valid_classic_address
from app.config import settings
from app.models.schemas import (
    TransactionRequest,
    TransactionSubmitRequest,
    TransactionResponse,
    XummPayloadResponse,
    XummPayloadStatus,
    TrustlineCheckRequest,
    TrustlineCheckResponse,
)
from concurrent.futures import ThreadPoolExecutor
import aiohttp

router = APIRouter()

# XRPL Client
client = JsonRpcClient(settings.xrpl_rpc_url)
executor = ThreadPoolExecutor(max_workers=5)


async def _check_trustline(destination: str, currency: str) -> tuple[bool, str | None]:
    """Return whether the destination has the issuer trustline for the given currency."""

    if currency.upper() == "XRP":
        return True, None

    if not is_valid_classic_address(destination):
        return False, "Destination address is not a valid XRPL classic address"

    loop = asyncio.get_event_loop()

    def _request_lines():
        return client.request(
            AccountLines(account=destination, peer=settings.rlusd_issuer)
        )

    response = await loop.run_in_executor(executor, _request_lines)
    lines = response.result.get("lines", []) if hasattr(response, "result") else []

    for line in lines:
        if line.get("currency") == settings.rlusd_code:
            return True, None

    return False, "Recipient is missing the RLUSD trustline to the issuer"


@router.post("/prepare", response_model=TransactionResponse)
async def prepare_payment(req: TransactionRequest):
    """
    Prepare an unsigned RLUSD payment transaction for Crossmark signing.

    This endpoint creates a proper XRPL transaction that can be signed by Crossmark.
    """
    try:
        # Check if this is an RLUSD or XRP payment based on currency parameter
        if req.currency and req.currency.upper() != "XRP":
            # For issued currencies (RLUSD), use the standard 3-letter code
            # Crossmark will validate and process it
            tx_json = {
                "TransactionType": "Payment",
                "Destination": req.destination,
                "Amount": {
                    "currency": "USD",  # 3-letter code for Crossmark compatibility
                    "issuer": settings.rlusd_issuer,
                    "value": str(req.amount),
                },
            }
            print(f"[PREPARE] RLUSD (issued currency) payment: {json.dumps(tx_json)}")
        else:
            # For XRP, use drops format (native currency)
            amount_drops = str(int(float(req.amount) * 1_000_000))
            tx_json = {
                "TransactionType": "Payment",
                "Destination": req.destination,
                "Amount": amount_drops,  # XRP in drops as string
            }
            print(f"[PREPARE] XRP payment: {json.dumps(tx_json)}")

        return TransactionResponse(
            tx_json=tx_json,
            signing_pub_key="",
            message="Transaction ready for Crossmark signing",
        )
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/validate-recipient", response_model=TrustlineCheckResponse)
async def validate_recipient(req: TrustlineCheckRequest):
    """Validate that the recipient can accept the payment (trustline for RLUSD)."""

    if not is_valid_classic_address(req.destination):
        raise HTTPException(
            status_code=400,
            detail="Destination address is not a valid XRPL classic address",
        )

    has_trust, reason = await _check_trustline(req.destination, req.currency)
    return TrustlineCheckResponse(has_trustline=has_trust, reason=reason)


@router.post("/submit", response_model=TransactionResponse)
async def submit_payment(req: TransactionSubmitRequest):
    """
    Submit a signed RLUSD payment transaction to XRPL.

    Expects a signed transaction from Crossmark wallet containing tx_blob.
    """
    try:
        loop = asyncio.get_event_loop()

        # Extract tx_blob from signed transaction
        tx_blob = req.signed_tx.get("tx_blob") or req.signed_tx.get("txBlob")

        if not tx_blob:
            raise ValueError("Missing tx_blob in signed transaction")

        print(f"[SUBMIT] Submitting tx_blob: {tx_blob[:50]}...")

        # Submit signed transaction to XRPL using SubmitOnly (tx_blob path)
        submit_request = SubmitOnly(tx_blob=tx_blob)
        response = await loop.run_in_executor(
            executor, lambda: client.request(submit_request)
        )

        print(f"[SUBMIT] Response: {response.result}")

        # Extract transaction hash from response
        result = response.result
        tx_hash = result.get("tx_json", {}).get("hash") or result.get("tx_hash")

        if not tx_hash:
            # Try alternate field names
            tx_hash = result.get("hash") or result.get("transaction", {}).get("hash")

        return TransactionResponse(
            tx_json=req.signed_tx,
            signing_pub_key="",
            tx_hash=tx_hash or "pending",
            message=f"Transaction submitted to XRPL",
        )
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{tx_hash}")
async def get_transaction(tx_hash: str):
    """Get transaction details by hash"""
    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            executor, lambda: client.request(Tx(transaction=tx_hash))
        )
        return response.tx
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Transaction not found: {str(e)}")


def _ripple_epoch_to_iso(epoch_seconds: int | None) -> str | None:
    """Convert XRPL epoch seconds (since 2000-01-01) to ISO8601."""
    if epoch_seconds is None:
        return None
    return (datetime(2000, 1, 1) + timedelta(seconds=epoch_seconds)).isoformat() + "Z"


@router.post("/xumm/prepare", response_model=XummPayloadResponse)
async def prepare_xumm(req: TransactionRequest):
    """Create a XUMM payload for RLUSD payments (uses XUMM signing flow)."""

    if not settings.xumm_api_key or not settings.xumm_api_secret:
        raise HTTPException(
            status_code=500,
            detail="Missing XUMM_API_KEY or XUMM_API_SECRET. Set them in the environment to enable RLUSD.",
        )

    if not is_valid_classic_address(req.destination):
        raise HTTPException(
            status_code=400,
            detail="Destination address is not a valid XRPL classic address",
        )

    if not is_valid_classic_address(settings.rlusd_issuer):
        raise HTTPException(
            status_code=500,
            detail="Configured RLUSD issuer is not a valid XRPL classic address",
        )

    try:
        tx_json = {
            "TransactionType": "Payment",
            "Destination": req.destination,
            "Amount": {
                "currency": settings.rlusd_code,
                "issuer": settings.rlusd_issuer,
                "value": str(req.amount),
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

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://xumm.app/api/v1/platform/payload",
                json=payload_request,
                headers=headers,
            ) as resp:
                data = await resp.json()
                print(f"[XUMM PREPARE] status={resp.status} data={data}")
                if resp.status >= 300:
                    # Bubble up XUMM error details to client
                    raise HTTPException(status_code=resp.status, detail=data)

        return XummPayloadResponse(
            uuid=data.get("uuid"),
            next_url=data.get("next", {}).get("always")
            or data.get("next", {}).get("no_redirect"),
            qr_url=data.get("refs", {}).get("qr_png"),
            expires_at=_ripple_epoch_to_iso(data.get("expires_at")),
            pushed=data.get("pushed"),
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - thin wrapper
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/xumm/trustline")
async def prepare_xumm_trustline():
    """Create a XUMM payload for adding the RLUSD trustline."""

    if not settings.xumm_api_key or not settings.xumm_api_secret:
        raise HTTPException(
            status_code=500,
            detail="Missing XUMM_API_KEY or XUMM_API_SECRET. Set them in the environment to enable RLUSD.",
        )

    if not is_valid_classic_address(settings.rlusd_issuer):
        raise HTTPException(
            status_code=500,
            detail="Configured RLUSD issuer is not a valid XRPL classic address",
        )

    tx_json = {
        "TransactionType": "TrustSet",
        "LimitAmount": {
            "currency": settings.rlusd_code,
            "issuer": settings.rlusd_issuer,
            "value": "1000000000",  # large cap for trustline
        },
        "Flags": 131072,  # tfSetNoRipple flag off (default), tfClearNoRipple not set
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
                print(f"[XUMM TRUSTLINE] status={resp.status} data={data}")
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
    except Exception as exc:  # pragma: no cover - thin wrapper
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/xumm/status/{uuid}", response_model=XummPayloadStatus)
async def xumm_status(uuid: str):
    """Check signing status for a XUMM payload."""

    if not settings.xumm_api_key or not settings.xumm_api_secret:
        raise HTTPException(
            status_code=500,
            detail="Missing XUMM_API_KEY or XUMM_API_SECRET. Set them in the environment to enable RLUSD.",
        )

    headers = {
        "X-API-Key": settings.xumm_api_key,
        "X-API-Secret": settings.xumm_api_secret,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://xumm.app/api/v1/platform/payload/{uuid}",
                headers=headers,
            ) as resp:
                data = await resp.json()
                if resp.status >= 300:
                    raise HTTPException(status_code=resp.status, detail=data)

        meta = data.get("meta", {})
        response = data.get("response", {})
        txid = response.get("txid")
        signed = bool(meta.get("signed"))

        return XummPayloadStatus(
            uuid=uuid,
            signed=signed,
            txid=txid,
            expires_at=_ripple_epoch_to_iso(meta.get("expires_at")),
            error=response.get("hex") if not signed else None,
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - thin wrapper
        raise HTTPException(status_code=500, detail=str(exc))
