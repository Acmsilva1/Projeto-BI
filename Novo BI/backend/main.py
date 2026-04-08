from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import ps_router, cc_router, financeiro_router, ocupacao_router, kpi_router

app = FastAPI(title="Hospital BI - MVC", version="1.1.0")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão de Roteadores (Controllers) com prefixos centralizados
app.include_router(ps_router.router, prefix="/api/v1/ps")
app.include_router(cc_router.router, prefix="/api/v1/cirurgia")
app.include_router(financeiro_router.router, prefix="/api/v1/financeiro")
app.include_router(ocupacao_router.router, prefix="/api/v1/ocupacao")
app.include_router(kpi_router.router, prefix="/api/v1/kpi")

@app.get("/health")
async def health():
    return {"status": "ok", "architecture": "mvc"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
