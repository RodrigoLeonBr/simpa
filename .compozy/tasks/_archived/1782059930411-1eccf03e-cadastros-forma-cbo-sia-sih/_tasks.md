# Cadastros Forma/CBO SIA/SIH — Task List

**Feature:** `cadastros-forma-cbo-sia-sih`  
**PRD:** [_prd.md](./_prd.md) · **TechSpec:** [_techspec.md](./_techspec.md)

## Tasks

| # | Título | Status | Complexidade | Dependências |
|---|--------|--------|--------------|--------------|
| 01 | Migration PostgreSQL para formas_sia e cbos_sia | completed | medium | — |
| 02 | Extender sync_cadastros_mysql para extrair forma e cbo | completed | high | task_01 |
| 03 | Normalização de códigos forma/cbo e inativação segura | completed | medium | task_02 |
| 04 | Atualizar cadastrosSync.js para novos contadores | completed | low | task_02 |
| 05 | Criar serviços de listagem formas e cbos | completed | medium | task_01 |
| 06 | Expor rotas GET de formas e cbos em cadastros | completed | low | task_05 |
| 07 | Testes backend das novas rotas e histórico de sync | completed | medium | task_04, task_06 |
| 08 | Adicionar cards Forma e CBO no cadastroEntities | completed | low | — |
| 09 | Criar páginas frontend de listagem Formas e CBOs | completed | medium | task_06, task_08 |
| 10 | Integrar rotas Cadastros e atualizar testes de grid/navegação | completed | low | task_09 |
| 11 | Integrar descrições de forma e cbo no fluxo SIA | completed | medium | task_02, task_05 |
| 12 | Preparar extensão SIH e atualizar documentação técnica | completed | low | task_11 |

## Marcos de entrega

- **Marco A (dados):** tasks 01-04 concluídas.
- **Marco B (API/backend):** tasks 05-07 concluídas.
- **Marco C (frontend + integração final):** tasks 08-12 concluídas.

## Critério de pronto

- Sincronização completa sem regressão em estabelecimentos/procedimentos.
- APIs e telas de Forma/CBO estáveis e cobertas por testes.
- Documentação atualizada para orientar uso por SIA e futura adoção no SIH.
