"""Credential endpoints: create, status, verify"""

from fastapi import APIRouter, Header, HTTPException, Query
from xrpl.clients import JsonRpcClient
from xrpl.core.addresscodec import is_valid_classic_address
from xrpl.wallet import Wallet
from app.config import settings
from app.models.schemas import (
    CredentialCreateRequest,
    CredentialCreateResponse,
    CredentialRequest,
    CredentialResponse,
    CredentialStatusResponse,
    CredentialVerifyResponse,
)

router = APIRouter()

# XRPL Client
client = JsonRpcClient(settings.xrpl_rpc_url)

LSF_ACCEPTED = 0x00010000


@router.post("/issue", response_model=CredentialResponse)
async def issue_credential(req: CredentialRequest):
    """
    Issue a verifiable credential for KYC verification

    In production, this would be called only after Onfido/Jumio verification.
    """
    try:
        # TODO: Implement DID credential issuance
        # - Verify user email
        # - Create W3C-compliant credential
        # - Store credential in DID on ledger
        # - Return credential ID and transaction hash

        return CredentialResponse(
            success=False,
            message="DID credential service not yet implemented",
            error="Coming soon - integration with credential issuing on-chain",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify/{did_address}")
async def verify_kyc(did_address: str):
    """
    Verify KYC status by resolving DID and checking credentials
    """
    try:
        # TODO: Implement DID credential verification
        # - Extract address from DID (did:xrpl:1:rAddress)
        # - Query DID from ledger
        # - Read credential metadata
        # - Return KYC verification status

        return {
            "kyc_verified": False,
            "message": "DID credential verification not yet implemented",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _ensure_credential_config():
    if not settings.credential_issuer_seed or not settings.credential_issuer_address:
        raise HTTPException(status_code=400, detail="Credential issuer seed/address not configured")


def _check_credential_status(address: str) -> CredentialStatusResponse:
    if not is_valid_classic_address(address):
        raise HTTPException(status_code=400, detail="Invalid XRPL classic address")

    if not settings.credential_issuer_address:
        raise HTTPException(status_code=400, detail="Credential issuer address not set")

    request = {
        "command": "ledger_entry",
        "credential": {
            "subject": address,
            "issuer": settings.credential_issuer_address,
            "credential_type": settings.credential_type_hex,
        },
    }

    try:
        resp = client.request(request)
        node = resp.result.get("node") or {}
        flags = node.get("Flags", 0)
        accepted = bool(flags & LSF_ACCEPTED)
        return CredentialStatusResponse(
            subject=address,
            issuer=settings.credential_issuer_address,
            credential_type=settings.credential_type_hex,
            accepted=accepted,
            raw_flags=flags,
            message="Credential found",
        )
    except Exception as e:
        # If not found, xrpl-py raises, so treat as not accepted
        return CredentialStatusResponse(
            subject=address,
            issuer=settings.credential_issuer_address,
            credential_type=settings.credential_type_hex,
            accepted=False,
            raw_flags=None,
            message=str(e),
        )


@router.post("/create", response_model=CredentialCreateResponse)
async def create_credential(
    req: CredentialCreateRequest,
    x_credential_token: str | None = Header(default=None, convert_underscores=False),
):
    """Law-firm/issuer issues a credential to a subject (demo)."""

    _ensure_credential_config()

    if settings.credential_admin_token and x_credential_token != settings.credential_admin_token:
        raise HTTPException(status_code=401, detail="Invalid credential admin token")

    if not is_valid_classic_address(req.subject):
        raise HTTPException(status_code=400, detail="Subject must be a valid XRPL classic address")

    tx_json = {
        "TransactionType": "CredentialCreate",
        "Account": settings.credential_issuer_address,
        "Subject": req.subject,
        "CredentialType": settings.credential_type_hex,
    }

    if req.uri:
        tx_json["URI"] = req.uri.encode().hex().upper()

    try:
        wallet = Wallet.from_seed(settings.credential_issuer_seed)
        submit_req = {
            "command": "submit",
            "tx_json": tx_json,
            "secret": wallet.seed,
        }
        result = client.request(submit_req)
        engine_result = result.result.get("engine_result")
        txid = result.result.get("tx_json", {}).get("hash") or result.result.get("hash")
        submitted = engine_result in {"tesSUCCESS", "terQUEUED"}
        return CredentialCreateResponse(
            submitted=submitted,
            txid=txid,
            engine_result=engine_result,
            message="Submitted credential create" if submitted else f"Submission returned {engine_result}",
            error=None if submitted else result.result.get("engine_result_message"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=CredentialStatusResponse)
async def credential_status(address: str = Query(..., description="XRPL classic address")):
    """Return on-ledger credential status (accepted flag)."""

    return _check_credential_status(address)


@router.get("/verify", response_model=CredentialVerifyResponse)
async def verify_permission(address: str = Query(..., description="XRPL classic address")):
    """Mock credential/permission check to gate RLUSD flows for demo purposes."""

    if not address:
        raise HTTPException(status_code=400, detail="Missing address")

    status = _check_credential_status(address)
    if status.accepted:
        return CredentialVerifyResponse(
            allowed=True,
            accepted=True,
            level=1,
            reason="Credential accepted on-ledger",
            allowlist_hit=False,
        )

    allowlist = [addr.strip() for addr in settings.credential_allowlist.split(",") if addr.strip()]

    if not allowlist:
        # Temporary open gate for judging when no allowlist configured
        return CredentialVerifyResponse(
            allowed=True,
            accepted=False,
            level=1,
            reason="Allowlist empty - gate open (temporary)",
            allowlist_hit=False,
        )

    hit = address in allowlist

    if hit:
        return CredentialVerifyResponse(
            allowed=True,
            accepted=False,
            level=1,
            reason="Allowlisted address",
            allowlist_hit=True,
        )

    # Default deny when not allowlisted and not credential-accepted
    return CredentialVerifyResponse(
        allowed=False,
        accepted=False,
        level=0,
        reason="Address not credential-accepted or allowlisted (demo gate)",
        allowlist_hit=False,
    )
