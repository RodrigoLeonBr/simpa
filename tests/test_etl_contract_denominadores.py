"""Tests for etl_contract.py — _denominadores() and pop_row integration in build_payload()."""
from datetime import date
from typing import Any

import pytest

from etl_contract import _denominadores, _build_indicadores_qualidade, build_payload


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _pop_row(cidadaos_ativos: int = 3337, gest_sim: int = 24,
             menos1_m: int = 31, menos1_f: int = 26,
             f5a9_m: int = 108, f5a9_f: int = 113,
             f10a14_m: int = 109, f10a14_f: int = 102) -> dict[str, Any]:
    return {
        "cidadaos_ativos": cidadaos_ativos,
        "saidas": 1198,
        "faixa_etaria": [
            {"faixa": "Menos de 01 ano", "masculino": menos1_m, "feminino": menos1_f},
            {"faixa": "01 ano", "masculino": 19, "feminino": 16},
            {"faixa": "05 a 09 anos", "masculino": f5a9_m, "feminino": f5a9_f},
            {"faixa": "10 a 14 anos", "masculino": f10a14_m, "feminino": f10a14_f},
            {"faixa": "80 anos ou mais", "masculino": 31, "feminino": 42},
        ],
        "condicoes_saude": {
            "gestante": {"sim": gest_sim, "nao": 284, "nao_informado": 3029},
            "hipertensao": {"sim": 313, "nao": 603, "nao_informado": 2421},
            "diabetes": {"sim": 123, "nao": 762, "nao_informado": 2452},
        },
        "raca_cor": {"branca": 2570},
        "sociodemografico": {},
        "extras": {},
    }


def _raw_rows():
    return []  # empty — build_payload tolerates no e-SUS rows


# ---------------------------------------------------------------------------
# _denominadores()
# ---------------------------------------------------------------------------

def test_denominadores_none_returns_empty():
    assert _denominadores(None) == {}


def test_denominadores_zero_ativos_returns_empty():
    assert _denominadores({"cidadaos_ativos": 0, "faixa_etaria": [], "condicoes_saude": {}}) == {}


def test_denominadores_c1_igm_aps_icsap_use_cidadaos_ativos():
    result = _denominadores(_pop_row(cidadaos_ativos=3337))
    assert result["C1"] == 3337
    assert result["IGM-APS"] == 3337
    assert result["IGM-ICSAP"] == 3337


def test_denominadores_igm_pn_uses_gestante_sim():
    result = _denominadores(_pop_row(gest_sim=24))
    assert result["IGM-PN"] == 24


def test_denominadores_igm_pn_absent_when_zero():
    result = _denominadores(_pop_row(gest_sim=0))
    assert "IGM-PN" not in result


def test_denominadores_igm_vac_uses_menos_de_01_ano():
    result = _denominadores(_pop_row(menos1_m=31, menos1_f=26))
    assert result["IGM-VAC"] == 57  # 31 + 26


def test_denominadores_igm_vac_absent_when_zero():
    result = _denominadores(_pop_row(menos1_m=0, menos1_f=0))
    assert "IGM-VAC" not in result


def test_denominadores_b4_sums_faixas_05a09_and_10a14():
    # 108+113 (05-09) + 109+102 (10-14) = 432
    result = _denominadores(_pop_row(f5a9_m=108, f5a9_f=113, f10a14_m=109, f10a14_f=102))
    assert result["B4"] == 432


def test_denominadores_b4_absent_when_zero():
    result = _denominadores(_pop_row(f5a9_m=0, f5a9_f=0, f10a14_m=0, f10a14_f=0))
    assert "B4" not in result


def test_denominadores_odontology_codes_absent():
    """B1, B2, B3, B5, B6, M1, M2 never appear — denominators come from production data."""
    result = _denominadores(_pop_row())
    for cod in ("B1", "B2", "B3", "B5", "B6", "M1", "M2"):
        assert cod not in result, f"{cod} should not be in denominadores"


def test_denominadores_missing_faixa_etaria_key():
    """pop_row with no faixa_etaria → IGM-VAC and B4 absent, rest OK."""
    pop = {"cidadaos_ativos": 500, "condicoes_saude": {}, "faixa_etaria": []}
    result = _denominadores(pop)
    assert result["C1"] == 500
    assert "IGM-VAC" not in result
    assert "B4" not in result


def test_denominadores_missing_condicoes_saude_key():
    """pop_row with no condicoes_saude → IGM-PN absent."""
    pop = {"cidadaos_ativos": 500, "condicoes_saude": {}, "faixa_etaria": []}
    result = _denominadores(pop)
    assert "IGM-PN" not in result


# ---------------------------------------------------------------------------
# _build_indicadores_qualidade()
# ---------------------------------------------------------------------------

def test_build_indicadores_qualidade_without_pop_row_all_den_dash():
    result = _build_indicadores_qualidade(None)
    for entry in result:
        assert entry["den"] == "—", f"{entry['cod']} should have den='—' but got {entry['den']!r}"


def test_build_indicadores_qualidade_with_pop_row_c1_numeric():
    result = _build_indicadores_qualidade(_pop_row())
    c1 = next(e for e in result if e["cod"] == "C1")
    assert c1["den"] == 3337


def test_build_indicadores_qualidade_b4_has_den_nota_always():
    """den_nota must be present on B4 regardless of pop_row."""
    for pop in (None, _pop_row()):
        result = _build_indicadores_qualidade(pop)
        b4 = next(e for e in result if e["cod"] == "B4")
        assert "den_nota" in b4
        assert "Aproximado" in b4["den_nota"]


def test_build_indicadores_qualidade_b1_den_dash_with_pop_row():
    """B1 is odontology — must keep den='—' even with pop_row provided."""
    result = _build_indicadores_qualidade(_pop_row())
    b1 = next(e for e in result if e["cod"] == "B1")
    assert b1["den"] == "—"


def test_build_indicadores_qualidade_returns_all_13_indicators():
    result = _build_indicadores_qualidade()
    codes = {e["cod"] for e in result}
    expected = {"C1", "B1", "B2", "B3", "B4", "B5", "B6", "M1", "M2",
                "IGM-APS", "IGM-PN", "IGM-VAC", "IGM-ICSAP"}
    assert codes == expected


# ---------------------------------------------------------------------------
# build_payload() integration
# ---------------------------------------------------------------------------

def _base_payload_args():
    return dict(
        competencia=date(2026, 1, 1),
        municipio="AMERICANA",
        unidade="PSF JD ALVORADA",
        equipe="TODAS",
        raw_rows=_raw_rows(),
    )


def test_build_payload_without_pop_row_backward_compatible():
    """Existing callers without pop_row must produce same output (all den='—')."""
    payload = build_payload(**_base_payload_args())
    indicadores = payload["indicadores_qualidade"]
    assert all(e["den"] == "—" for e in indicadores)


def test_build_payload_with_pop_row_c1_den_numeric():
    payload = build_payload(**_base_payload_args(), pop_row=_pop_row())
    indicadores = payload["indicadores_qualidade"]
    c1 = next(e for e in indicadores if e["cod"] == "C1")
    assert c1["den"] == 3337


def test_build_payload_with_pop_row_igm_pn_den_numeric():
    payload = build_payload(**_base_payload_args(), pop_row=_pop_row(gest_sim=24))
    indicadores = payload["indicadores_qualidade"]
    igm_pn = next(e for e in indicadores if e["cod"] == "IGM-PN")
    assert igm_pn["den"] == 24


def test_build_payload_with_pop_row_igm_vac_den_numeric():
    payload = build_payload(**_base_payload_args(), pop_row=_pop_row(menos1_m=31, menos1_f=26))
    indicadores = payload["indicadores_qualidade"]
    igm_vac = next(e for e in indicadores if e["cod"] == "IGM-VAC")
    assert igm_vac["den"] == 57


def test_build_payload_with_pop_row_b4_den_numeric():
    payload = build_payload(**_base_payload_args(),
                            pop_row=_pop_row(f5a9_m=108, f5a9_f=113, f10a14_m=109, f10a14_f=102))
    indicadores = payload["indicadores_qualidade"]
    b4 = next(e for e in indicadores if e["cod"] == "B4")
    assert b4["den"] == 432
    assert "den_nota" in b4


def test_build_payload_with_pop_row_odontology_still_dash():
    payload = build_payload(**_base_payload_args(), pop_row=_pop_row())
    indicadores = payload["indicadores_qualidade"]
    for cod in ("B1", "B2", "B3", "B5", "B6", "M1", "M2"):
        entry = next(e for e in indicadores if e["cod"] == cod)
        assert entry["den"] == "—", f"{cod} den should be '—' but got {entry['den']!r}"


def test_build_payload_pop_row_none_produces_dash_for_all():
    payload = build_payload(**_base_payload_args(), pop_row=None)
    indicadores = payload["indicadores_qualidade"]
    assert all(e["den"] == "—" for e in indicadores)


def test_build_payload_preserves_kpis_with_pop_row():
    """pop_row must not affect kpis_gerais."""
    payload = build_payload(**_base_payload_args(), pop_row=_pop_row())
    kpis = payload["kpis_gerais"]
    assert "total_atendimentos_aps" in kpis
    assert "total_procedimentos_ambulatoriais" in kpis
