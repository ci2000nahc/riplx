"""Balance query endpoints"""

import asyncio
from fastapi import APIRouter, HTTPException
from xrpl.clients import JsonRpcClient
from xrpl.models.requests import AccountLines, AccountInfo
from app.config import settings
from app.models.schemas import BalanceResponse
from concurrent.futures import ThreadPoolExecutor

router = APIRouter()

# XRPL Client (testnet)
client = JsonRpcClient(settings.xrpl_rpc_url)
executor = ThreadPoolExecutor(max_workers=5)


@router.get("/{address}", response_model=BalanceResponse)
async def get_balance(address: str):
    """
    Get RLUSD and XRP balance for an address

    Args:
        address: XRPL address (e.g., rN7n7otQDd6FczFgLdlqtyMVrDPvdHAY5M)

    Returns:
        BalanceResponse with XRP and RLUSD balances
    """
    try:
        loop = asyncio.get_event_loop()

        # Use sync client in thread pool to avoid blocking
        print(f"[BALANCE] Querying address: {address}")
        account_info = await loop.run_in_executor(
            executor, lambda: client.request(AccountInfo(account=address))
        )
        print(f"[BALANCE] account_info.result keys: {account_info.result.keys()}")
        
        # Balance is nested under account_data
        xrp_balance = account_info.result.get("account_data", {}).get("Balance", "0")
        print(f"[BALANCE] XRP balance (drops): {xrp_balance}")

        # Get RLUSD balance (from trustlines)
        trustlines = await loop.run_in_executor(
            executor, lambda: client.request(AccountLines(account=address))
        )
        print(f"[BALANCE] trustlines result keys: {trustlines.result.keys()}")
        rlusd_balance = "0"

        # Extract lines from response
        lines = trustlines.result.get("lines", [])
        print(f"[BALANCE] Found {len(lines)} trustlines")

        # RLUSD is encoded as hex in the currency field
        # "524C555344000000000000000000000000000000" = hex("RLUSD" padded)
        rlusd_hex = "524C555344000000000000000000000000000000"
        
        for line in lines:
            print(f"[BALANCE] Checking line currency: {line.get('currency')}, account: {line.get('account')}")
            if (
                line.get("currency") == rlusd_hex
            ):
                rlusd_balance = line.get("balance", "0")
                print(f"[BALANCE] Found RLUSD: {rlusd_balance}")
                break

        response = BalanceResponse(
            address=address, xrp_balance=xrp_balance, rlusd_balance=rlusd_balance
        )
        print(f"[BALANCE] Returning: {response}")
        return response
    except Exception as e:
        import traceback

        print(f"Error in get_balance: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Balance error: {str(e)}")
