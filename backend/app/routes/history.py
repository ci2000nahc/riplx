"""Transaction history endpoints"""

import asyncio
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from xrpl.clients import JsonRpcClient
from xrpl.models.requests import AccountTx
from concurrent.futures import ThreadPoolExecutor

from app.config import settings
from app.models.schemas import TransactionHistoryResponse, TransactionHistoryItem

router = APIRouter()

client = JsonRpcClient(settings.xrpl_rpc_url)
executor = ThreadPoolExecutor(max_workers=5)


def _to_iso_timestamp(ripple_epoch_seconds: int | None) -> str | None:
    """Convert XRPL epoch (seconds since 2000-01-01) to ISO8601 string."""
    if ripple_epoch_seconds is None:
        return None
    # XRPL epoch starts at 2000-01-01T00:00:00Z
    return (datetime(2000, 1, 1) + timedelta(seconds=ripple_epoch_seconds)).isoformat() + "Z"


@router.get("/{address}", response_model=TransactionHistoryResponse)
async def get_history(address: str, limit: int = 20):
    """Return recent payment transactions for an account."""
    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            executor,
            lambda: client.request(
                AccountTx(
                    account=address,
                    limit=limit,
                    binary=False,
                    ledger_index_min=-1,
                    ledger_index_max=-1,
                    forward=False,
                )
            ),
        )

        txs = []
        for entry in response.result.get("transactions", []):
            tx = entry.get("tx", {})
            meta = entry.get("meta", {})

            if tx.get("TransactionType") != "Payment":
                continue

            amount_field = tx.get("Amount")
            currency = "XRP"
            issuer = None
            amount = "0"

            if isinstance(amount_field, dict):
                amount = str(amount_field.get("value"))
                currency = amount_field.get("currency", "")
                issuer = amount_field.get("issuer")
            else:
                try:
                    amount = f"{int(amount_field) / 1_000_000:.6f}"
                except Exception:
                    amount = str(amount_field)

            txs.append(
                TransactionHistoryItem(
                    hash=tx.get("hash") or entry.get("hash"),
                    transaction_type=tx.get("TransactionType"),
                    amount=amount,
                    currency=currency,
                    destination=tx.get("Destination"),
                    issuer=issuer,
                    status="validated" if entry.get("validated") else "pending",
                    ledger_index=tx.get("ledger_index") or tx.get("LedgerIndex"),
                    timestamp=_to_iso_timestamp(tx.get("date")),
                )
            )

        return TransactionHistoryResponse(address=address, transactions=txs)
    except Exception as exc:  # pragma: no cover - thin wrapper
        raise HTTPException(status_code=500, detail=f"History error: {str(exc)}")
