"""DID Credentials endpoints"""

from fastapi import APIRouter, HTTPException, Query
from xrpl.clients import JsonRpcClient
from app.config import settings
from app.models.schemas import (
    CredentialRequest,
    CredentialResponse,
    CredentialVerifyResponse,
)

router = APIRouter()

# XRPL Client
client = JsonRpcClient(settings.xrpl_rpc_url)


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


@router.get("/verify", response_model=CredentialVerifyResponse)
async def verify_permission(address: str = Query(..., description="XRPL classic address")):
    """Mock credential/permission check to gate RLUSD flows for demo purposes."""

    if not address:
        raise HTTPException(status_code=400, detail="Missing address")

    allowlist = [addr.strip() for addr in settings.credential_allowlist.split(",") if addr.strip()]

    if not allowlist:
        # Temporary open gate for judging when no allowlist configured
        return CredentialVerifyResponse(
            allowed=True,
            level=1,
            reason="Allowlist empty - gate open (temporary)",
            allowlist_hit=False,
        )

    hit = address in allowlist

    if hit:
        return CredentialVerifyResponse(
            allowed=True,
            level=1,
            reason="Allowlisted address",
            allowlist_hit=True,
        )

    # Default deny when not allowlisted (replace with real DID/credential checks)
    return CredentialVerifyResponse(
        allowed=False,
        level=0,
        reason="Address not in credential allowlist (demo gate)",
        allowlist_hit=False,
    )
