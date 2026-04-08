from fastapi import APIRouter
from typing import Optional
from ..models.financeiro_model import FinanceiroModel

router = APIRouter(tags=["Financeiro"], strict_slashes=False)

@router.get("/resumo")
async def get_resumo(unidade: Optional[str] = None, regional: Optional[str] = None):
    try:
        data = FinanceiroModel.get_resumo(unidade, regional)
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@router.get("/convenio")
async def get_por_convenio(unidade: Optional[str] = None, regional: Optional[str] = None):
    try:
        data = FinanceiroModel.get_por_convenio(unidade, regional)
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@router.get("/glosas")
async def get_glosas(unidade: Optional[str] = None, regional: Optional[str] = None):
    # Mocking glosas for now
    return {"ok": True, "data": {"total": 387420, "percentualFaturamento": 4.2, "porMotivo": []}}
