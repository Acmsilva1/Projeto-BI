"""
Transformações opcionais com Polars sobre o payload do bundle.
Por omissão devolve os dados inalterados; estenda aqui pivots / joins quando
as views SQL estiverem estáveis.
"""

from __future__ import annotations

from typing import Any

import polars as pl


def apply_bundle_polars(data: dict[str, Any]) -> dict[str, Any]:
    """
    Hook de processamento. Exemplo futuro: normalizar listas tabulares antes da cache.

    Evita alterar o contrato JSON do front até as transformações estarem validadas.
    """
    return data


def polars_version() -> str:
    return pl.__version__
