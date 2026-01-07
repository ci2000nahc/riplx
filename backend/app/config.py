# Backend Configuration

from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """XRPL and application configuration"""

    # XRPL Network Configuration
    xrpl_network: str = "testnet"
    xrpl_rpc_url: str = "https://s.altnet.rippletest.net:51234"
    xrpl_testnet_explorer: str = "https://testnet.xrpl.org/"

    # RLUSD Configuration (testnet faucet issuer)
    # Currency code uses 160-bit hex for RLUSD
    # RLUSD issuer (testnet) - align with faucet/token you're holding
    rlusd_issuer: str = "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV"
    rlusd_code: str = "524C555344000000000000000000000000000000"

    # XUMM / Xaman Integration
    xumm_api_key: Optional[str] = None
    xumm_api_secret: Optional[str] = None

    # Credential allowlist for demo permissioning (comma-separated XRPL addresses)
    credential_allowlist: str = ""

    # Credential issuer (for CredentialCreate/Accept flows)
    credential_issuer_seed: Optional[str] = None
    credential_issuer_address: Optional[str] = None
    credential_type_hex: str = "41434352454449544544"  # "ACCREDITED" hex
    credential_admin_token: Optional[str] = None

    # Server Configuration
    backend_port: int = 8000
    backend_host: str = "0.0.0.0"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # DID & Credentials (for credential issuing service)
    issuer_seed: Optional[str] = None
    issuer_address: Optional[str] = None
    issuer_sign_token: Optional[str] = None

    class Config:
        # Load env from backend/.env first, fallback to repo root .env
        env_file = (
            Path(__file__).resolve().parent.parent / ".env",
            Path(__file__).resolve().parent.parent.parent / ".env",
        )
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields from .env


settings = Settings()
