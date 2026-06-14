# Estrutura do Sistema SIMPA — Modelo CRM (Cadastros, Importação, Metas e Indicadores)

Este documento descreve a estrutura de telas/menus proposta para o SIMPA no formato de um sistema de gestão (CRM-like): login, cadastros mestres, importação de dados com acompanhamento de cargas, módulo de metas e módulo de indicadores. Complementa o `PRD_SIMPA.md` e os agentes em `.claude/agents/`.

## 1. Login / Autenticação

- Tela de login (usuário/senha; SSO a avaliar).
- Recuperação de senha.
- Perfis de acesso (ver `simpa-lgpd-security`):
  - **Administrador** — acesso total, gerencia usuários/perfis.
  - **Gestor Secretaria** — visão município (todas as unidades).
  - **Gestor de Unidade** — escopo restrito à(s) sua(s) unidade(s)/equipe(s).
  - **Planejamento** — acesso a metas, indicadores e emendas, visão município.

## 2. Estrutura de Menu Principal

1. **Painel** (Dashboard)
2. **Cadastros**
3. **Importação**
4. **Metas**
5. **Indicadores**
6. **Relatórios**
7. **Administração**

## 3. Detalhamento por módulo

### 3.1 Painel (Dashboard)

Tela inicial pós-login. KPIs gerais (`kpis_gerais` do contrato JSON), filtros por competência/unidade/equipe, atalhos para os módulos de Metas e Indicadores. Modelo visual "OCI Regional" (PRD Seção 7.4) — ver pendência de alinhamento na Seção 6 deste documento.

### 3.2 Cadastros

Telas de CRUD (listar / criar / editar / inativar — preferir soft delete por integridade referencial com cargas históricas).

| Submenu | Campos principais | Tabela (existente/nova) | Observações |
|---|---|---|---|
| **Unidades de Saúde** | código, nome, tipo (APS / MAC / Hospitalar / Misto), CNES, endereço, esfera (própria / contratualizada-OSS), status | `unidades_saude` (nova) | Hoje `unidade` é texto livre em `esus_cargas`/`dados_consolidados`; migrar para FK preservando o nome para compatibilidade com cargas antigas. |
| **Equipes** | código (equivalente a `equipe_codigo` do e-SUS), nome, unidade vinculada, tipo (ESF, EAP, etc.), status | `equipes` (nova) | Vincula a `esus_cargas.equipe_codigo`/`equipe_nome`. |
| **Profissionais / CBO** | nome ou só CBO (cuidado LGPD), unidade/equipe, status | `profissionais` ou apenas `cbo_aux` | Avaliar com `simpa-lgpd-security` se cadastro de profissional nominal é necessário ou se basta CBO agregado. |
| **Procedimentos** | código SIGTAP, descrição, tipo (ambulatorial/hospitalar), tabela de referência (SIGTAP / SUS Paulista), valor de referência | `procedimentos` (nova, tabela auxiliar) | Usado para vincular metas de emendas a códigos de produção (PRD 14.2). |
| **Prestadores MAC** | nome, CNES, tipo de contrato, status | `prestadores_mac` (nova) | Fonte: SIA/SUS. |
| **Hospitais** | nome, CNES, tipo (próprio/contratualizado/OSS), nº de leitos, status | `hospitais` (nova) | Fonte: SIHD/AIH. |
| **Tabelas Auxiliares** | CID-10, faixas etárias, tipos de relatório e-SUS (somente leitura, derivado de `TIPO_RELATORIO_MAP`), municípios (benchmarking regional), CBO | tabelas `aux_*` | Mantidas pelo `simpa-db-architect`; tipos de relatório devem ficar sincronizados com o agente `simpa-etl-esus`. |
| **Programas / Emendas Parlamentares** | id_emenda, esfera, tipo, autor, objeto, valor repassado, status | `emendas_parlamentares` (Fase 2) | Cadastro inicial; acompanhamento físico fica no módulo Metas. |

### 3.3 Importação

| Submenu | Função | Observações |
|---|---|---|
| **Importar e-SUS APS** | Upload dos 5 CSVs (atendimento individual, odontológico, atividade coletiva, marcadores de consumo alimentar, procedimentos individualizados), preview de tipo/competência/unidade/equipe detectados, botão "Processar" | Conversão ISO-8859-1 → UTF-8 automática; ver `simpa-etl-esus`. |
| **Importar SIA (MAC)** | Upload manual ou sincronização com a instância MySQL/XAMPP (somente leitura) | Instabilidade da instância é risco conhecido (PRD Seção 9). |
| **Importar SIHD / AIH** | Upload de arquivo de exportação AIH (DBF/CSV) | Enquanto não houver arquivo: `status_importacao: "PENDING_AIH_FILE"`. |
| **Histórico de Cargas** (CRUD sobre `esus_cargas`) | Listagem com tipo_relatorio, competência, unidade, equipe, status, arquivo_origem, importado_em, registros identificados/não identificados. Ações: ver detalhes (drill-down em `esus_indicadores_raw`), reprocessar (idempotente via `ON CONFLICT`), excluir (cascade) | Filtros por competência, unidade, tipo, status. |
| **Logs / Erros de Importação** | Falhas de parsing, linhas não identificadas, alertas de encoding | — |

### 3.4 Metas

| Submenu | Campos principais | Tabela | Observações |
|---|---|---|---|
| **Cadastro de Metas** | indicador (FK catálogo), unidade/equipe (opcional — pode ser nível município), competência/vigência, valor da meta, origem (Componente Qualidade APS, IGM SUS Paulista, Emenda Parlamentar, Meta Local) | `metas_financiamento` (Fase 2) | Ver `simpa-health-financing` para origem normativa das metas oficiais. |
| **Acompanhamento de Metas** | Meta vs. Executado vs. % de atingimento, por indicador/unidade/competência | leitura de `metas_financiamento` + `dados_consolidados` | `null` = "não apurado" — nunca tratar como zero. |
| **Emendas Parlamentares — Acompanhamento** | Vincula emenda a metas de produção: código SIGTAP/grupo AIH, meta física, executado físico, % execução | `emendas_metas_producao` (Fase 2) | Cruzamento mensal automático via ETL (PRD 14.2). |

### 3.5 Indicadores

| Submenu | Função | Observações |
|---|---|---|
| **Catálogo de Indicadores** (CRUD) | Criação/edição de indicadores: nome, descrição, fórmula (numerador/denominador ou expressão), fonte de dados (seção/descrição de `esus_indicadores_raw`, SIA, SIHD), periodicidade, categoria (C1 / B1-B6 / M1-M2 / IGM / local), unidade de medida | Versionar fórmulas — indicadores normativos (C1, B1-B6, M1/M2, IGM) mudam por portaria (ver `simpa-health-financing`). Não travar fórmula sem confirmação. |
| **Painel de Indicadores** | Visualização: gráficos de tendência (ECharts), comparação entre unidades, drill-down por competência. Filtros: indicador, unidade, equipe, competência, categoria | Consome o catálogo + `dados_consolidados`. |
| **Indicadores Federais/Estaduais** | Vista dedicada ao Componente Qualidade da APS (C1, B1-B6, M1/M2) e IGM SUS Paulista, com status de apuração | — |

### 3.6 Relatórios

- **Comparativo entre Unidades** — benchmarking (tabela + gráfico) por indicador/competência.
- **Exportação** — PDF/Excel dos comparativos e painéis.

### 3.7 Administração

- **Usuários e Perfis de Acesso** — gestão de contas e escopo (unidade/equipe).
- **Auditoria / Logs** — quem acessou o quê, quando.
- **Configurações Gerais** — ex.: competência ativa padrão, parâmetros do sistema.

## 4. Considerações de modelagem (para `simpa-db-architect`)

Novas tabelas mestres necessárias: `unidades_saude`, `equipes`, `procedimentos`, `prestadores_mac`, `hospitais`, `indicadores` (catálogo), `metas_financiamento`, `emendas_parlamentares`, `emendas_metas_producao`, além de tabelas auxiliares (`cid10`, `faixas_etarias`, etc.). `esus_cargas` passa a ser a base do "Histórico de Cargas".

Os campos `unidade`/`equipe_nome` em `esus_cargas`/`dados_consolidados` são hoje texto livre — recomenda-se migração futura para FK em `unidades_saude`/`equipes`, mantendo compatibilidade retroativa com cargas já importadas (ex.: coluna de texto livre como fallback/legado).

## 5. Mapeamento Menu → Agente técnico responsável

| Módulo | Agentes a consultar |
|---|---|
| Cadastros (unidades, equipes, procedimentos, prestadores, hospitais, auxiliares, emendas) | `simpa-db-architect` (novas tabelas mestres), `simpa-backend-api` (endpoints CRUD), `simpa-frontend-dashboard` (telas) |
| Importação | `simpa-etl-esus` (parsers/conectores), `simpa-db-architect` (histórico de cargas) |
| Metas | `simpa-db-architect` (tabelas Fase 2), `simpa-health-financing` (origem/normas das metas), `simpa-backend-api` |
| Indicadores | `simpa-health-financing` (definição/fórmulas), `simpa-db-architect` (catálogo), `simpa-frontend-dashboard` (visualização) |
| Relatórios | `simpa-frontend-dashboard`, `simpa-backend-api` |
| Administração / perfis | `simpa-lgpd-security`, `simpa-backend-api` |
| Visão geral / priorização | `simpa-product-planning` |

## 6. Pendências e decisões a confirmar

- Cadastro de "Profissionais": avaliar com `simpa-lgpd-security` se cadastro nominal é necessário ou se basta nível CBO agregado.
- Migração de `unidade`/`equipe_nome` de texto livre para FK — planejar estratégia de migração sem quebrar cargas históricas.
- Fórmulas dos indicadores normativos (C1, B1-B6, M1/M2, IGM) — confirmar versão vigente com a Secretaria antes de implementar o catálogo definitivo.
- **"OCI Regional" (referência visual do Painel)**: o próprio PRD (nota da Seção 14.2 / glossário) aponta ambiguidade — pode ser (a) referência de UI/UX de um painel regional já em uso, ou (b) o conceito de Oferta de Cuidados Integrados (Seção 13.5/PMAE), que agruparia procedimentos SIGTAP por linha de cuidado. Validar com a Unidade de Planejamento antes de tratar isso apenas como "estilo visual" — pode implicar uma visão adicional no módulo Indicadores/Relatórios (execução por OCI/linha de cuidado).