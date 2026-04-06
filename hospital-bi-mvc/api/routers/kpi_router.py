from fastapi import APIRouter
from typing import Optional

router = APIRouter(tags=["KPIs"], redirect_slashes=False, strict_slashes=False)

@router.get("")
async def get_kpis(unidade: Optional[str] = None, regional: Optional[str] = None):
    return {
        "ok": True,
        "data": {
            "atendimentos": 69929,
            "taxaOcupacao": {"valor": 84.2, "unidade": "%", "variacao": 2.1, "tendencia": "alta", "meta": 85},
            "cirurgiasNoMes": {"valor": 312, "unidade": "proced.", "variacao": 18, "tendencia": "alta", "meta": 300},
            "satisfacaoPaciente": {"valor": 91.4, "unidade": "%", "variacao": 1.2, "tendencia": "alta", "meta": 90}
        }
    }
