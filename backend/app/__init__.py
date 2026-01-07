"""
XRPL Payment Application Backend
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import balance, transactions, credentials, history, rwa

# Initialize FastAPI app
app = FastAPI(
    title="RLUSD Payment API",
    description="Payment app using RLUSD on XRP Ledger with DID integration",
    version="0.1.0",
)

# CORS Middleware
origins = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(balance.router, prefix="/api/balance", tags=["balance"])
app.include_router(
    transactions.router, prefix="/api/transactions", tags=["transactions"]
)
app.include_router(credentials.router, prefix="/api/credentials", tags=["credentials"])
app.include_router(history.router, prefix="/api/history", tags=["history"])
app.include_router(rwa.router, prefix="/api/rwa", tags=["rwa"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "RLUSD Payment API",
        "network": settings.xrpl_network,
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check for deployment"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.backend_host, port=settings.backend_port)
