from fastapi import APIRouter
from typing import Optional
from ..models.ocupacao_model import OcupacaoModel

router = APIRouter(tags=["Ocupação"], strict_slashes=False)

@router.get("/setor")
async def get_ocup_setor(unidade: Optional[str] = None, regional: Optional[str] = None):
    try:
        data = OcupacaoModel.get_por_setor(unidade, regional)
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@router.get("/tendencia")
async def get_ocup_tendencia(unidade: Optional[str] = None, regional: Optional[str] = None):
    # Mocking tendencia for now
    return {"ok": True, "data": {"labels": [], "series": []}}

@router.get("/qualidade")
async def get_ocup_qualidade(unidade: Optional[str] = None, regional: Optional[str] = None):
    return {"ok": True, "data": {"satisfacao": 94, "nps": 88}}
