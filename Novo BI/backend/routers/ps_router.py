from fastapi import APIRouter, Query
from typing import Optional
from ..models.ps_model import PSModel

router = APIRouter(tags=["Pronto Socorro"], strict_slashes=False)

@router.get("/volumes")
async def get_volumes(unidade: Optional[str] = None, regional: Optional[str] = None):
    try:
        data = PSModel.get_volumes(unidade, regional)
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@router.get("/slas")
async def get_slas(
    unidade: Optional[str] = None, 
    regional: Optional[str] = None,
    triagem: int = 12,
    consulta: int = 90,
    alta: int = 180
):
    try:
        data = PSModel.get_sla_stats(unidade, regional, triagem, consulta, alta)
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@router.get("/matrix")
async def get_matrix(triagem: int = 12, consulta: int = 90, alta: int = 180):
    try:
        data = PSModel.get_matrix(triagem, consulta, alta)
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}
