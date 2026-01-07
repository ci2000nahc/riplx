"""Data models and schemas for API requests/responses"""

from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal


class BalanceResponse(BaseModel):
    """Response model for balance queries"""

    address: str
    xrp_balance: str = Field(..., description="XRP balance in drops")
    rlusd_balance: str = Field(..., description="RLUSD balance")
    rlusd_currency: str = "USD"
    error: Optional[str] = None


class TransactionRequest(BaseModel):
    """Request model for transaction preparation"""

    destination: str
    amount: str = Field(
        ..., description="Amount in drops (for XRP) or decimal (for RLUSD)"
    )
    currency: str = "USD"
    invoice_id: Optional[str] = None


class TransactionSubmitRequest(BaseModel):
    """Request model for transaction submission"""

    signed_tx: dict = Field(..., description="Signed transaction JSON from wallet")


class TransactionResponse(BaseModel):
    """Response model for transaction submission"""

    tx_json: dict
    signing_pub_key: str
    hash: Optional[str] = None
    tx_hash: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None


class TransactionHistoryItem(BaseModel):
    """Single transaction item for history feed"""

    hash: Optional[str] = None
    transaction_type: Optional[str] = None
    amount: str
    currency: str
    destination: Optional[str] = None
    issuer: Optional[str] = None
    status: str
    ledger_index: Optional[int] = None
    timestamp: Optional[str] = None


class TransactionHistoryResponse(BaseModel):
    """Transaction history list for an address"""

    address: str
    transactions: list[TransactionHistoryItem]


class XummPayloadResponse(BaseModel):
    """Response payload for initiating a XUMM signing flow"""

    uuid: str
    next_url: str
    qr_url: Optional[str] = None
    expires_at: Optional[str] = None
    pushed: Optional[bool] = None


class XummPayloadStatus(BaseModel):
    """Status response for a XUMM payload"""

    uuid: str
    signed: bool
    txid: Optional[str] = None
    expires_at: Optional[str] = None
    error: Optional[str] = None


class TrustlineCheckRequest(BaseModel):
    """Request model for validating a recipient trustline"""

    destination: str
    currency: str = "USD"


class TrustlineCheckResponse(BaseModel):
    """Response model for trustline validation"""

    has_trustline: bool
    reason: Optional[str] = None


class CredentialRequest(BaseModel):
    """Request model for credential issuance"""

    user_email: str
    kyc_status: str = Field(..., description="'verified' or 'rejected'")
    kyc_level: int = Field(
        ..., ge=1, le=3, description="1=basic, 2=full, 3=institutional"
    )
    did_address: Optional[str] = None


class CredentialResponse(BaseModel):
    """Response model for credential operations"""

    success: bool
    credential_id: Optional[str] = None
    tx_hash: Optional[str] = None
    message: str
    error: Optional[str] = None


class CredentialVerifyResponse(BaseModel):
    """Response model for permission/credential gating"""

    allowed: bool
    level: int = 1
    reason: Optional[str] = None
