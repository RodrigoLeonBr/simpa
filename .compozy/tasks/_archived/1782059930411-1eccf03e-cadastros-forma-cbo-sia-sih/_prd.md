# PRD — Cadastros de Forma (Grupo/Subgrupo/Forma) e CBO para SIA/SIH

**Feature:** `cadastros-forma-cbo-sia-sih`  
**Versão:** 1.0  
**Data:** 2026-06-21  
**Status:** Draft  
**Fonte funcional:** `producao.sql` (estrutura MySQL de produção)

---

## Visão geral

O SIMPA já espelha `prestador` e `procedimento` do MySQL para o PostgreSQL, mas ainda não possui cadastros dedicados para:

- `forma` (hierarquia `grupo` -> `subgrupo` -> `forma` -> `descricao`), usada para classificar procedimentos;
- `cbo` (`CBO`, `DS_CBO`), usada para classificar profissionais.

No dump de produção, essas dimensões são centrais para leitura analítica do SIA:

- `s_prd.prd_cbo` referencia CBO;
- `s_prd` já deriva `grupo/subgrupo/forma` de `prd_pa` e possui índices para isso;
- `s_pap.PAP_CBO` também aparece como campo indexado.

Objetivo: trazer esses dois cadastros para o domínio SIMPA, com sincronização a partir do MySQL e exposição no menu de `Cadastros`, preparando uso imediato no SIA e uso progressivo no SIH.

---

## Objetivos

1. Disponibilizar no PostgreSQL as tabelas espelho de `forma` e `cbo`, com status e timestamp de sincronização.
2. Expor APIs de consulta para `forma` e `cbo` no padrão de `cadastros`.
3. Incluir cartões e rotas no menu `Cadastros` para navegação e consulta.
4. Integrar esses domínios ao pipeline de sync de cadastros (`POST /api/cadastros/sincronizar`).
5. Garantir compatibilidade para consumo por SIA agora e SIH em próxima etapa sem retrabalho de modelo.

---

## Escopo funcional (MVP)

### F1 — Espelho MySQL -> PostgreSQL (forma + cbo)

- Sincronizar `forma` e `cbo` do MySQL de produção.
- UPSERT por chave de negócio:
  - `forma.codigo_forma` (6 chars, vindo de `forma.forma`);
  - `cbo.codigo_cbo` (6 chars, vindo de `cbo.CBO`).
- Inativar registros ausentes no snapshot (mesma regra usada para procedimentos/estabelecimentos, com proteção para snapshot vazio).

### F2 — Cadastros no backend

- Endpoints de leitura:
  - `GET /api/cadastros/formas`
  - `GET /api/cadastros/cbos`
- Filtro de busca textual (`q`) e paginação leve para navegação.
- Somente leitura no MVP (sem CRUD manual).

### F3 — Cadastros no frontend

- Incluir cards em `Cadastros`:
  - **Forma (Grupo/Subgrupo/Forma)**
  - **CBO (Classificação de Profissionais)**
- Criar páginas de listagem com busca e colunas chave.
- Mensagem contextual: "origem MySQL, somente leitura, atualiza via sincronização".

### F4 — Preparação SIA/SIH

- SIA: permitir enriquecimento de consultas para exibir `descricao_forma` e `descricao_cbo` em relatórios/dashboards.
- SIH: definir contrato de integração por código (`forma` e `cbo`) para quando o pipeline SIH estiver ativo.

---

## Fora de escopo (agora)

- Edição manual de `forma` e `cbo` no SIMPA.
- Remodelagem completa dos painéis SIA/SIH no mesmo pacote.
- Alteração de esquema na base MySQL de origem.
- Nova governança de permissões por registro.

---

## Critérios de sucesso

1. Sincronização de cadastros retorna contadores separados para `formas` e `cbos`.
2. APIs de leitura de `formas` e `cbos` respondem em ambiente local e docker.
3. Menu de `Cadastros` exibe os dois novos cartões sem regressão dos existentes.
4. Testes backend e frontend cobrem listagem, filtros e integração do menu.
5. SIA consegue resolver pelo menos um relatório usando joins com descrições de forma e CBO.

---

## Riscos e mitigação

- **Risco:** divergência de padding/formato de códigos (`prd_cbo` com 8 vs `cbo.CBO` com 6).  
  **Mitigação:** normalização canônica (trim + left pad quando necessário) e testes de compatibilidade.

- **Risco:** snapshot incompleto no MySQL causar inativação indevida.  
  **Mitigação:** regra de proteção para snapshot vazio e validação de volume mínimo.

- **Risco:** SIH ainda não possui pipeline consolidado no repositório.  
  **Mitigação:** entregar contrato e pontos de extensão sem bloquear o MVP SIA.
