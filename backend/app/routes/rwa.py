"""RWA minting (gated demo)."""

from fastapi import APIRouter, HTTPException
from xrpl.clients import JsonRpcClient
from xrpl.core.addresscodec import is_valid_classic_address
from app.config import settings
from app.models.schemas import RwaMintRequest, RwaMintResponse

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
