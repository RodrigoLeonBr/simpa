"""Match helpers for legacy unidades_saude → estabelecimentos migration."""

from __future__ import annotations


def resolve_codigo_externo(
    unidade_codigo: str | None,
    unidade_cnes: str | None,
    disponiveis: set[str],
) -> str | None:
    """
    Resolve estabelecimentos.codigo_externo from legacy unidade fields.

    Priority: exact codigo match, then trimmed cnes match.
    """
    codigo = (unidade_codigo or "").strip()
    cnes = (unidade_cnes or "").strip()

    if codigo and codigo in disponiveis:
        return codigo
    if cnes and cnes in disponiveis:
        return cnes
    return None
