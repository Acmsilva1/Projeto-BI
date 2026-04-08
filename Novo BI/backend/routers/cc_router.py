from fastapi import APIRouter
from typing import Optional
from ..models.cc_model import CCModel

router = APIRouter(tags=["Centro Cirúrgico"], strict_slashes=False)

@router.get("/performance")
async def get_performance(unidade: Optional[str] = None, regional: Optional[str] = None):
    try:
        data = CCModel.get_performance(unidade, regional)
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@router.get("/especialidade")
async def get_especialidade(unidade: Optional[str] = None, regional: Optional[str] = None):
    return {"ok": True, "data": {"labels": ["Geral", "Ortopedia"], "datasets": []}}
