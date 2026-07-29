from sync_cadastros_mysql import build_entity_plan

ESTAB_FIELDS = ["nome", "cnpj", "re_tipo", "tipouni", "perfil", "area", "relatorio", "status"]
ESTAB_EDITADO = {"nome": "nome_editado", "perfil": "perfil_editado", "status": "status_editado"}


def test_novo_traz_so_mysql():
    mysql_rows = [{"codigo_externo": "111", "nome": "UBS A", "cnpj": None, "re_tipo": None,
                   "tipouni": "1", "perfil": "APS", "area": None, "relatorio": None, "status": "ativo"}]
    pg_rows = {}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert len(items) == 1
    assert items[0]["tipo"] == "novo"
    assert items[0]["chave"] == "111"
    assert items[0]["diff"]["nome"] == {"mysql": "UBS A"}
    assert "simpa" not in items[0]["diff"]["nome"]


def test_alterado_so_campos_que_diferem():
    mysql_rows = [{"codigo_externo": "111", "nome": "UBS A", "cnpj": None, "re_tipo": None,
                   "tipouni": "1", "perfil": "APS", "area": None, "relatorio": None, "status": "inativo"}]
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "ativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": False}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert len(items) == 1
    assert items[0]["tipo"] == "alterado"
    assert list(items[0]["diff"].keys()) == ["status"]
    assert items[0]["diff"]["status"] == {"simpa": "ativo", "mysql": "inativo"}


def test_campo_editado_nao_entra_no_diff():
    mysql_rows = [{"codigo_externo": "111", "nome": "UBS A", "cnpj": None, "re_tipo": None,
                   "tipouni": "1", "perfil": "APS", "area": None, "relatorio": None, "status": "inativo"}]
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "ativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": True}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert items == []


def test_sumiu_do_mysql():
    mysql_rows = []
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "ativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": False}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert len(items) == 1
    assert items[0]["tipo"] == "sumiu"
    assert items[0]["diff"] == {"status": {"simpa": "ativo"}}


def test_sumiu_ignora_ja_inativo():
    mysql_rows = []
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "inativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": False}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert items == []


def test_sumiu_ignora_status_editado():
    mysql_rows = []
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "ativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": True}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert items == []


def test_editado_parcial_mantem_outros_campos():
    # status_editado=True (SIMPA-owner) mas nome tambem difere -> alterado so com nome
    mysql_rows = [{"codigo_externo": "111", "nome": "UBS RENOMEADA", "cnpj": None, "re_tipo": None,
                   "tipouni": "1", "perfil": "APS", "area": None, "relatorio": None, "status": "inativo"}]
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "ativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": True}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert len(items) == 1
    assert items[0]["tipo"] == "alterado"
    assert list(items[0]["diff"].keys()) == ["nome"]
    assert items[0]["diff"]["nome"] == {"simpa": "UBS A", "mysql": "UBS RENOMEADA"}
