# PRD — SIMPA (Sistema Integrado de Monitoramento e Planejamento de Americana)

**Versão do documento:** 1.0
**Data:** 13/06/2026
**Responsável:** Unidade de Planejamento — Secretaria de Saúde de Americana/SP
**Status:** Rascunho para alinhamento técnico

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Objetivos e Métricas de Sucesso](#2-objetivos-e-métricas-de-sucesso)
3. [Stakeholders e Personas](#3-stakeholders-e-personas)
4. [Escopo Funcional (Módulos do Sistema)](#4-escopo-funcional-módulos-do-sistema)
5. [Arquitetura Spec-Driven (Especificação de Dados)](#5-arquitetura-spec-driven-especificação-de-dados)
6. [Stack Tecnológica Recomendada](#6-stack-tecnológica-recomendada)
7. [Requisitos Não-Funcionais](#7-requisitos-não-funcionais)
8. [Roadmap e Fases](#8-roadmap-e-fases)
9. [Riscos e Dependências](#9-riscos-e-dependências)
10. [Fora de Escopo](#10-fora-de-escopo)
11. [Critérios de Aceite e QA](#11-critérios-de-aceite-e-qa)
12. [Guia de Discussão com a Equipe Técnica](#12-guia-de-discussão-com-a-equipe-técnica)
13. [Indicadores de Financiamento Federal e Estadual](#13-indicadores-de-financiamento-federal-e-estadual)
14. [Acompanhamento de Emendas Parlamentares](#14-acompanhamento-de-emendas-parlamentares)
15. [Glossário](#15-glossário)

---

## 1. Visão Geral do Produto

O SIMPA é a plataforma estratégica de **Business Intelligence (BI)** e governança em saúde desenvolvida pela Unidade de Planejamento da Secretaria de Saúde de Americana/SP.

O sistema unifica os dados operacionais, clínicos, de produção ambulatorial e de desfechos hospitalares que hoje residem em sistemas fragmentados e isolados (silos). Por meio de uma arquitetura centralizada e orientada a dados, o SIMPA entregará painéis gerenciais focados em:

- **Performance de Equipes** — acompanhamento da produção clínica, odontológica e de ações coletivas por equipe e unidade.
- **Análise de Tendências Históricas** — séries temporais para antecipar picos de demanda e sazonalidades.
- **Acompanhamento de Metas de Saúde Governamentais** — comparação entre produção real e metas regulamentadas.
- **Benchmarking Inter-Unidades** — comparação de desempenho entre equipes, unidades e a média municipal.

O projeto nasce de forma modular e evolutiva, com uma Fase 1 (MVP) baseada em ingestão de arquivos e extração de banco local, evoluindo para uma Fase 2 com integração automatizada às bases oficiais do município.

---

## 2. Objetivos e Métricas de Sucesso

### 2.1 Objetivos do Projeto

- Eliminar a dependência de planilhas manuais e relatórios isolados para a gestão da Atenção Primária, Média/Alta Complexidade e Atenção Hospitalar.
- Fornecer aos gestores uma visão consolidada e atualizada mensalmente do desempenho de cada unidade e equipe de saúde.
- Permitir o acompanhamento sistemático de metas de saúde definidas pelo planejamento municipal.
- Criar uma base de dados única e extensível (PostgreSQL/JSONB) capaz de incorporar novos módulos de saúde sem retrabalho estrutural.

### 2.2 Métricas de Sucesso (KPIs do Projeto)

| Métrica | Meta (Fase 1 — MVP) | Meta (Fase 2) |
|---|---|---|
| Unidades de saúde com dados carregados no SIMPA | ≥ 80% das unidades do município | 100% das unidades |
| Tempo de geração do relatório mensal consolidado | Redução de dias para minutos (carga via script) | Atualização automática sem intervenção manual |
| Frequência de atualização dos dados | Mensal (carga manual de arquivos) | Mensal/automática via réplica do e-SUS |
| Adoção pelos gestores | Uso ativo por coordenadores de pelo menos 3 unidades-piloto | Uso ativo por todos os coordenadores e pela Secretaria |
| Cobertura de módulos de dados | e-SUS APS + SIA/SUS conectados | + SIHD/SUS integrado de forma recorrente |

> Observação: os KPIs acima medem o **sucesso do projeto**. Os KPIs exibidos *dentro* dos dashboards (total de atendimentos, procedimentos, participantes em ações coletivas etc.) são indicadores de saúde pública, detalhados na Seção 4.

---

## 3. Stakeholders e Personas

| Perfil | Papel no projeto | Necessidades principais |
|---|---|---|
| **Secretário(a) de Saúde / Diretoria** | Patrocinador, usuário da Visão Executiva | Indicadores consolidados, comparação entre unidades, acompanhamento de metas |
| **Unidade de Planejamento (gestora do projeto)** | Define regras de negócio, metas e prioridades | Acesso completo aos dados, configuração de metas, exportação de relatórios |
| **Coordenadores de Unidade de Saúde (UBS, CAFI, UPA etc.)** | Usuários dos painéis de Performance e Benchmarking | Visão da própria unidade/equipe vs. média municipal |
| **Equipes de Atenção Primária (eSF/EAP)** | Origem dos dados de produção (e-SUS) | Indireta — não acessam o sistema diretamente na Fase 1 |
| **TI da Secretaria Municipal** | Provedor de acesso às bases (réplica e-SUS, MySQL/XAMPP do SIA) | Especificação clara de requisitos de acesso e segurança |
| **Equipe de Desenvolvimento (Dados, Backend, Frontend)** | Constrói e mantém o sistema | Contrato de API estável, especificações claras (este PRD) |

---

## 4. Escopo Funcional (Módulos do Sistema)

### Módulo 1 — Ingestão de Dados e ETL Centralizado

- **Atenção Primária (e-SUS APS):** mapeamento e parse adaptativo dos arquivos analíticos consolidados por equipe e unidade de saúde — *Relatório de Atendimento Individual*, *Relatório de Atendimento Odontológico*, *Relatório de Atividade Coletiva*, *Relatório de Marcadores de Consumo Alimentar* e *Relatório de Procedimentos Individualizados*.
- **Modelagem inicial (PostgreSQL):** as tabelas `esus_cargas` (controle de carga/importação) e `esus_indicadores_raw` (EAV genérico em JSONB, espelhando as seções de cada relatório) compõem a base de staging para os 5 relatórios acima, alimentando posteriormente `dados_consolidados` conforme o contrato da Seção 5. Ver `schema_esus.sql`, `parse_esus_csv.py` e `seed_esus_2026-05_cafi.sql`.
- **Média e Alta Complexidade Ambulatorial (SIA/SUS):** conector automatizado para extração do histórico e produção especializada armazenados na instância MySQL/XAMPP local do município.
- **Atenção Hospitalar (SIHD/SUS):** módulo de importação de arquivos de Autorização de Internação Hospitalar (AIH — DBF/CSV) para processamento de morbidade, mortalidade hospitalar e faturamento.

### Módulo 2 — Painéis Gerenciais de Alta Fidelidade (Dashboards)

- **Visão Executiva (KPIs):** linha superior de indicadores exibindo total de atendimentos clínicos, procedimentos globais realizados, alcance de ações coletivas e produtividade odontológica.
- **Pirâmide Demográfica Espelhada:** cruzamento automático de faixa etária e sexo biológico a partir dos dados consolidados do e-SUS.
- **Monitoramento de Fluxo Operacional:** gráficos de rosca demonstrando a distribuição da demanda produtiva municipal dividida por turnos (Manhã, Tarde, Noite).
- **Perfil Epidemiológico e Temático:** gráficos de barras ordenados rastreando os temas mais abordados em ações coletivas e as principais patologias de vigilância bucal.

### Módulo 3 — Motor de Planejamento (Tendências e Benchmarking)

- **Análise de Séries Temporais:** linhas de tendência comparando o histórico acumulado mês a mês, para antecipar picos de demanda por especialidade ou sazonalidades endêmicas.
- **Mecanismo de Benchmarking:** interface que permite plotar, na mesma tela, o desempenho produtivo de uma equipe específica contra a média geral da unidade ou do município.
- **Camada de Metas:** injeção visual de linhas-guia de metas regulamentadas pelo planejamento de saúde da Secretaria Municipal.

### Módulo 4 — Indicadores de Financiamento e Acompanhamento de Emendas Parlamentares

- **Painel de Cofinanciamento Federal da APS:** acompanhamento dos indicadores do Componente de Qualidade do novo financiamento federal da APS (Portaria GM/MS nº 3.493/2024, atualizada pela Portaria GM/MS nº 6.907/2025) — Acesso e Vínculo (C1), acompanhamento de condições crônicas (HAS/DM), saúde da mulher e da criança, avaliação multidimensional da pessoa idosa, indicadores de saúde bucal (B1 a B6) e indicadores de equipes multiprofissionais (M1 e M2) — calculados a partir dos dados já ingeridos do e-SUS no Módulo 1. Detalhamento técnico na Seção 13.
- **Painel IGM SUS Paulista:** acompanhamento dos indicadores estaduais que compõem o componente variável de repasse do Governo de São Paulo (cobertura de APS, pré-natal, cobertura vacinal, ICSAP, controle de hipertensão/diabetes, citopatológico, arboviroses).
- **Monitor de Cofinanciamento Estadual (Tabela SUS Paulista):** cruzamento da produção registrada no SIA/SIHD com os valores complementares da Tabela SUS Paulista, estimando o cofinanciamento estadual gerado pela produção do município/unidade.
- **Cadastro e Acompanhamento de Emendas Parlamentares (municipal, estadual e federal):** registro das emendas recebidas pelo Fundo Municipal de Saúde, suas metas físicas pactuadas (ex.: nº de cirurgias, exames, AIHs, procedimentos SIGTAP) e cruzamento periódico com a produção real do SIA/SIHD para apurar o percentual de execução física de cada meta. Detalhamento na Seção 14.

---

## 5. Arquitetura Spec-Driven (Especificação de Dados)

Na arquitetura Spec-Driven, o **contrato da API é a verdade única do sistema**. O pipeline em Python sabe exatamente como estruturar e salvar os dados no PostgreSQL, e o frontend em React consome este modelo previsível sem depender de alterações estruturais no banco para a chegada de novos elementos de saúde.

### Contrato de Payload JSON Consolidado

**Endpoint:** `/api/v1/dashboard/planejamento`

```json
{
  "plataforma": "SIMPA - Sistema Integrado de Monitoramento e Planejamento de Americana",
  "versao_schema": "3.1.0",
  "competencia": "2026-05",
  "municipio": "AMERICANA",
  "filtros_ativos": {
    "unidade": "CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO",
    "equipe": "EQUIPE 9 EAP"
  },
  "kpis_gerais": {
    "total_atendimentos_aps": 540,
    "total_procedimentos_ambulatoriais": 1426,
    "total_participantes_coletivos": 810,
    "atendimentos_odonto": 209
  },
  "modulos": {
    "atencao_primaria_esus": {
      "distribuicao_turnos": [
        { "turno": "Manhã", "atendimentos": 575, "procedimentos": 882 },
        { "turno": "Tarde", "atendimentos": 455, "procedimentos": 543 }
      ],
      "temas_coletivos": [
        { "tema": "Alimentação saudável", "quantidade": 37 },
        { "tema": "Autocuidado de pessoas com doenças crônicas", "quantidade": 37 },
        { "tema": "Saúde mental", "quantidade": 6 }
      ]
    },
    "ambulatorial_sia": {
      "status_conexao": "MySQL_XAMPP_CONNECTED",
      "procedimentos_especializados": [
        { "codigo_sigtap": "0205020046", "descricao": "ULTRASSONOGRAFIA DE ABDOMEN TOTAL", "quantidade": 11 }
      ]
    },
    "hospitalar_sihd": {
      "status_importacao": "PENDING_AIH_FILE",
      "internacoes_por_capitulo_cid": []
    },
    "financiamento_metas": {
      "nota_tecnica": "Bloco introduzido na v3.1.0 (aditivo). Consolida indicadores de cofinanciamento federal/estadual calculados a partir dos módulos acima — ver Seção 13.",
      "componente_qualidade_aps": {
        "classificacao_geral": "BOM",
        "indicadores": [
          { "codigo": "C1", "nome": "Acesso e Vínculo (1ªs consultas programadas vs. demanda espontânea)", "equipe": "eSF/eAP", "valor": null, "meta": null },
          { "codigo": "B1", "nome": "1ª consulta odontológica programada na APS", "equipe": "eSB", "valor": null, "meta": null },
          { "codigo": "B2", "nome": "Tratamento odontológico concluído", "equipe": "eSB", "valor": null, "meta": null },
          { "codigo": "B3", "nome": "Taxa de exodontias na APS", "equipe": "eSB", "valor": null, "meta": null },
          { "codigo": "B4", "nome": "Escovação supervisionada (6 a 12 anos)", "equipe": "eSB", "valor": null, "meta": null },
          { "codigo": "B5", "nome": "Procedimentos preventivos odontológicos", "equipe": "eSB", "valor": null, "meta": null },
          { "codigo": "B6", "nome": "Tratamento Restaurador Atraumático (ART)", "equipe": "eSB", "valor": null, "meta": null },
          { "codigo": "M1", "nome": "Média de atendimentos por pessoa assistida pela eMulti", "equipe": "eMulti", "valor": null, "meta": null },
          { "codigo": "M2", "nome": "Ações interprofissionais compartilhadas", "equipe": "eMulti", "valor": null, "meta": null }
        ]
      },
      "igm_sus_paulista": {
        "componente_fixo": null,
        "componente_variavel": null,
        "indicadores": [
          { "nome": "Cobertura de Atenção Primária (eSF/eAP)", "valor": null, "meta": null },
          { "nome": "Pré-natal com 7+ consultas", "valor": null, "meta": null },
          { "nome": "Cobertura vacinal (menores de 1 ano)", "valor": null, "meta": null },
          { "nome": "ICSAP (Internações por Condições Sensíveis à APS)", "valor": null, "meta": null }
        ]
      },
      "tabela_sus_paulista": {
        "nota_tecnica": "Estimativa do cofinanciamento estadual com base na produção SIA/SIHD aprovada vs. valores complementares da Tabela SUS Paulista.",
        "valor_complementar_estimado": null
      }
    },
    "elementos_futuros": {
      "nota_tecnica": "Estrutura extensível via PostgreSQL JSONB para futuros módulos (Vacinação, Assistência Farmacêutica, Regulação)."
    }
  },
  "emendas_parlamentares": [
    {
      "id_emenda": "EX0001",
      "esfera": "federal",
      "tipo": "individual",
      "autor": "Exemplo Deputado(a)",
      "objeto": "Aquisição de equipamentos / custeio de procedimentos especializados",
      "valor_repassado": null,
      "vinculo_producao": {
        "sistema": "SIA",
        "codigos_sigtap": ["0205020046"],
        "meta_fisica": null,
        "executado_fisico": null,
        "percentual_execucao": null
      },
      "fonte_acompanhamento": "InvestSUS / Ambiente Parlamentar"
    }
  ]
}
```

### Princípios da especificação

- **Versionamento de schema:** o campo `versao_schema` deve ser incrementado sempre que houver alteração estrutural relevante no contrato (ex.: novo bloco em `modulos`). Mudanças aditivas (novos campos opcionais) não exigem incremento de versão maior.
- **Extensibilidade via JSONB:** novos blocos dentro de `modulos` (ex.: vacinação, assistência farmacêutica, regulação) podem ser adicionados sem alteração de schema físico no PostgreSQL.
- **Status explícitos por módulo:** cada bloco de módulo informa seu estado de integração (`status_conexao`, `status_importacao`), permitindo que o frontend exiba estados de "pendente"/"conectado" de forma transparente ao usuário.
- **Granularidade por filtro:** o payload é sempre retornado já filtrado por `competencia`, `unidade` e `equipe`, evitando processamento pesado no frontend.
- **v3.1.0 (aditiva):** introduz os blocos `modulos.financiamento_metas` e `emendas_parlamentares`, descritos nas Seções 13 e 14. Os campos `valor`/`meta`/`executado_fisico` iniciam como `null` até que o ETL e as fontes de pactuação (manual, na Fase 1) sejam conectados — o frontend deve tratar `null` como "indicador não apurado" e não como zero.

---

## 6. Stack Tecnológica Recomendada

| Camada | Tecnologia | Justificativa e Papel Técnico |
|---|---|---|
| **Banco de Dados** | PostgreSQL (v15+) | Banco de dados nativo do e-SUS PEC. Tabelas relacionais clássicas para metadados (indexação de buscas) em conjunto com o tipo avançado JSONB para os blocos dinâmicos extraídos, permitindo acoplar novos sistemas de saúde futuramente sem alterar a estrutura física das tabelas. |
| **ETL e Carga** | Python (Pandas / SQLAlchemy) | Pipeline de dados que se conecta simultaneamente à instância local do MySQL (XAMPP) do SIA, lê as exportações do SIHD e faz o parse estruturado linha por linha dos arquivos `.csv` do e-SUS, consolidando-os no banco central. |
| **Backend (API)** | Node.js (Express ou NestJS) | Expõe endpoints REST seguros e de alta performance, lê as colunas JSONB do PostgreSQL e despacha os payloads estruturados para o frontend. |
| **Frontend** | React.js + Vite | Framework moderno para interfaces web rápidas e modulares; o Vite garante empacotamento otimizado para os computadores da Secretaria de Saúde. |
| **Estilização** | Tailwind CSS + shadcn/ui | Framework CSS utilitário acoplado a componentes pré-moldados de acessibilidade, garantindo dashboard com acabamento profissional (cantos arredondados, paleta sóbria, responsividade). |
| **Visualização** | Apache ECharts | Motor gráfico de alta performance, capaz de renderizar pirâmides etárias espelhadas, gráficos de rosca para turnos operacionais e linhas de meta de forma fluida no navegador. |

---

## 7. Requisitos Não-Funcionais

### 7.1 Segurança e LGPD

- O SIMPA processa dados de saúde, classificados como **dados sensíveis** pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Os payloads consolidados (Seção 5) trabalham com **dados agregados por equipe/unidade**, não com identificação individual de pacientes — esse princípio de agregação deve ser preservado em qualquer extensão futura do schema.
- **Controle de acesso por perfil:** autenticação obrigatória, com perfis distintos (Secretaria/Planejamento com acesso municipal completo; coordenador de unidade com acesso restrito à própria unidade/equipe).
- **Trilha de auditoria:** registro de quem acessou quais relatórios e quando, especialmente para exportações.
- **Conexões a bases externas** (MySQL/XAMPP do SIA, réplica do e-SUS na Fase 2) devem usar usuários de leitura (read-only), com credenciais armazenadas de forma segura (variáveis de ambiente / cofre de segredos), nunca em código-fonte.

### 7.2 Desempenho

- Os endpoints de dashboard devem responder em até ~2 segundos para consultas filtradas por competência/unidade/equipe, dado o uso de índices GIN sobre colunas JSONB.
- O pipeline ETL mensal deve ser executável fora do horário de pico, com tempo de execução compatível com a janela de carga mensal (a definir com a equipe de dados).

### 7.3 Infraestrutura e Hospedagem

- Ambiente a ser definido entre **on-premise (servidores da Secretaria/Prefeitura)** ou **nuvem governamental**, considerando que os dados são públicos municipais, mas sensíveis quanto à granularidade de saúde.
- Backups periódicos do PostgreSQL (estrutura relacional + JSONB), com política de retenção a ser definida com a TI municipal.

### 7.4 Usabilidade e Acessibilidade

- Interface baseada no modelo OCI Regional, responsiva para uso em desktops das unidades e notebooks da gestão.
- Componentes shadcn/ui garantem aderência a padrões básicos de acessibilidade (contraste, navegação por teclado).

### 7.5 Manutenibilidade

- Contrato de API versionado (Seção 5) como única fonte de verdade entre ETL, backend e frontend.
- Esquema JSONB extensível para novos módulos sem migração estrutural do banco.

---

## 8. Roadmap e Fases

O SIMPA nascerá de forma modular, em fases.

### Fase 1 — MVP

- Ingestão de dados do **e-SUS via carregamento de arquivos locais** (.csv exportados manualmente).
- Extração automatizada do **SIA via conector MySQL/XAMPP**.
- Importação manual de arquivos **AIH (SIHD)** quando disponíveis (`status_importacao: PENDING_AIH_FILE` até a primeira carga).
- Disponibilização dos painéis gerenciais (Módulo 2) e do motor de planejamento (Módulo 3) com os dados carregados.
- Indicadores do Componente Qualidade da APS (C1, B1-B6, M1/M2 — Seção 13.2) calculados a partir dos dados do e-SUS já ingeridos.
- Cadastro manual de emendas parlamentares e suas metas físicas (Seção 14.2), com cruzamento automatizado contra a produção SIA/SIHD já carregada.
- Unidades-piloto definidas pela Unidade de Planejamento para validação.

### Fase 2 — Automação Plena

- Liberação, pela TI do município, de **usuário de leitura na réplica oficial do e-SUS**.
- Pipeline Python passa a puxar os dados do e-SUS **de forma 100% automatizada e invisível** ao usuário final.
- Mesmas telas e relatórios da Fase 1, sem necessidade de carregamento manual de arquivos.
- Avaliação de integração recorrente (não apenas pontual) do SIHD/AIH.
- Indicadores IGM SUS Paulista (Seção 13.3), dependentes de cobertura vacinal e SIHD/ICSAP.
- Monitor de cofinanciamento via Tabela SUS Paulista (Seção 13.4), mediante obtenção da tabela de valores complementares junto à SES/SP.

### Fase 3 — Expansão (visão futura, não detalhada neste PRD)

- Novos módulos via `elementos_futuros` (Vacinação, Assistência Farmacêutica, Regulação), aproveitando a extensibilidade JSONB.
- Painel de execução de Ofertas de Cuidados Integrados (OCI) por linha de cuidado (Seção 13.5), agrupando procedimentos SIGTAP do SIA.
- Integração semiautomática com InvestSUS/Ambiente Parlamentar e portais de transparência (Seção 14.3) para reduzir o cadastro manual de emendas.

---

## 9. Riscos e Dependências

| Risco / Dependência | Impacto | Mitigação |
|---|---|---|
| TI municipal não libera usuário de leitura na réplica do e-SUS (bloqueia Fase 2) | Alto — mantém dependência de carga manual de arquivos | Formalizar solicitação de acesso junto à TI já na Fase 1; manter pipeline de arquivo `.csv` como fallback permanente |
| Instabilidade ou descontinuação da instância MySQL/XAMPP do SIA | Alto — interrompe Módulo 1 (SIA) | Planejar migração futura do SIA para base mais robusta; manter conector isolado e configurável |
| Atrasos ou inconsistência nos arquivos AIH (DBF/CSV) do SIHD | Médio — módulo hospitalar permanece com `status_importacao: PENDING_AIH_FILE` | Tratar SIHD como módulo incremental desde o início (não bloqueante para o MVP) |
| Mudança de layout dos relatórios do e-SUS APS (atualizações do sistema nacional) | Médio — quebra do parser adaptativo | Parser deve validar cabeçalhos/colunas e alertar quando o formato não corresponder ao esperado |
| Adoção baixa pelos coordenadores de unidade | Médio — compromete métricas de sucesso (Seção 2) | Unidades-piloto com acompanhamento próximo da Unidade de Planejamento; capacitação inicial |
| Questões de LGPD/segurança não endereçadas a tempo | Alto — risco de não conformidade | Validar com jurídico/DPO municipal antes da Fase 1 entrar em produção |
| A partir de 2026 a classificação do Componente Qualidade da APS passa a refletir a nota real (Seção 13.1), impactando repasse federal | Alto — financeiro, fora do controle direto do SIMPA | SIMPA deve priorizar os indicadores C1/B1-B6/M1-M2 (Seção 13.2) já na Fase 1, para detecção precoce de quedas de desempenho |
| Metas oficiais (financiamento federal/estadual, emendas) publicadas em formatos não estruturados (PDF/portarias) | Médio — exige cadastro manual recorrente | Cadastro manual assistido pela Unidade de Planejamento na Fase 1; avaliar parsing semiautomático na Fase 3 |

---

## 10. Fora de Escopo

Os itens abaixo **não fazem parte** da entrega atual do SIMPA (Fases 1 e 2 descritas neste PRD):

- Módulos de Vacinação, Assistência Farmacêutica e Regulação — mencionados apenas como `elementos_futuros` (nota técnica de extensibilidade), sem especificação funcional nesta versão.
- Identificação individual de pacientes (CPF, nome, prontuário) nos dashboards — o SIMPA trabalha exclusivamente com dados agregados por equipe/unidade/competência.
- Aplicativo móvel nativo — a Fase 1/2 contemplam apenas interface web responsiva.
- Edição de dados de produção pelos usuários finais — o SIMPA é uma plataforma de leitura/análise, não um sistema de registro (não substitui e-SUS, SIA ou SIHD como fonte primária).
- Integração automatizada com o SIHD na Fase 1 (depende de avaliação na Fase 2/3).

---

## 11. Critérios de Aceite e QA

### 11.1 ETL / Pipeline Python

- Para cada fonte (e-SUS, SIA, SIHD), o pipeline deve gerar um payload validado contra o schema da Seção 5 antes da gravação no PostgreSQL.
- Discrepâncias entre totais agregados no payload e totais brutos dos arquivos de origem devem ser auditáveis (ex.: log de carga com contagem de linhas processadas vs. rejeitadas).
- Reprocessamento de uma competência (mês) já carregada deve ser idempotente (sobrescreve sem duplicar).

### 11.2 Backend / API

- O endpoint `/api/v1/dashboard/planejamento` deve responder corretamente aos filtros de `competencia`, `unidade` e `equipe`, retornando `404`/payload vazio coerente quando não houver dados para o filtro.
- Tempo de resposta dentro do definido na Seção 7.2 para os volumes esperados.

### 11.3 Frontend

- As três abas (Atenção Primária, Média Complexidade/SIA, Hospitalar/SIHD) devem funcionar de forma independente, refletindo os `status_conexao`/`status_importacao` de cada módulo.
- Gráficos do Apache ECharts (pirâmide etária, rosca de turnos, séries temporais, benchmarking) devem renderizar corretamente com o JSON mock antes da integração real com o backend.
- Linhas de meta (Camada de Metas) devem ser exibidas sobre os gráficos de tendência quando configuradas.

### 11.4 Validação com Usuários

- Pelo menos uma unidade-piloto valida os dados exibidos no SIMPA contra seus relatórios atuais antes da liberação geral.

---

## 12. Guia de Discussão com a Equipe Técnica

Roteiro de pautas específicas por perfil técnico, para alinhar o time e iniciar o desenvolvimento do SIMPA com máxima eficiência.

### 12.1 Engenheiro de Dados / Dev Python (ETL)
**Foco:** Conectores e Parseadores.

O script Python deve rodar de forma isolada. Precisa de uma string de conexão funcional para o MySQL local (SIA) e de uma pasta mapeada para o recebimento dos arquivos `.csv` do e-SUS e do SIHD. O objetivo principal é estruturar os dados agregados mensais e inseri-los no PostgreSQL respeitando rigorosamente as chaves mapeadas na especificação JSON (Seção 5).

### 12.2 Engenheiro de Software Backend (Node.js) e DBA
**Foco:** Estrutura PostgreSQL e Entrega da API.

Criação das tabelas mestre utilizando a coluna `dados_conteudo` (JSONB). Configurar índices do tipo **GIN** no PostgreSQL caso haja necessidade de buscas por chaves internas do JSON em larga escala. A API deve apenas ler o registro correspondente ao mês, ano e equipe solicitados, envelopar no payload padrão do SIMPA (Seção 5) e entregar ao frontend.

### 12.3 Desenvolvedor Frontend (React.js)
**Foco:** UI/UX e Implementação Gráfica.

Como o contrato da API já está assinado e fechado na documentação (Seção 5), o desenvolvimento do frontend pode começar imediatamente utilizando o JSON como mock estático. Estruturar a tela em três abas (Tabs): **Atenção Primária**, **Média Complexidade (SIA)** e **Hospitalar (SIHD)**. Implementar os gráficos do Apache ECharts focando em pirâmides etárias espelhadas e layouts de comparação (benchmarking).

### 12.4 Alinhamento Estratégico com a Gestão (Secretaria de Saúde)
**Foco:** Cronograma de Maturidade e Evolução.

O SIMPA nascerá de forma modular em fases (ver Seção 8). Na Fase 1 (MVP), os dados do e-SUS entram via carregamento de arquivos locais combinados com a extração do banco do SIA. Na Fase 2, assim que a TI do município liberar o usuário de leitura na réplica oficial do e-SUS, o pipeline em Python passa a puxar esses dados de forma 100% automatizada e invisível para o usuário final, mantendo as mesmas telas e relatórios do sistema.

---

## 13. Indicadores de Financiamento Federal e Estadual

Esta seção documenta, para referência da equipe técnica, os indicadores externos de financiamento e pactuação que o Módulo 4 (Seção 4) deve calcular ou acompanhar. Esses indicadores são derivados, na maior parte, dos próprios dados do e-SUS APS (Módulo 1) e da produção SIA/SIHD (Módulos 1 e 4), reaproveitando a base já ingerida pelo SIMPA — não exigem nova fonte de dados na Fase 1, exceto onde indicado.

### 13.1 Novo Financiamento Federal da APS (pós-Previne Brasil)

A Portaria GM/MS nº 3.493/2024 (atualizada pela Portaria GM/MS nº 6.907/2025) substituiu o modelo "Previne Brasil" e estrutura o cofinanciamento federal do Piso de Atenção Primária em seis componentes: (I) Fixo — manutenção de eSF/eAP e implantação de eSF/eAP/eSB/eMulti, calculado com base no Índice de Equidade e Dimensionamento (IED, que combina porte populacional e vulnerabilidade social); (II) Vínculo e Acompanhamento Territorial (eSF/eAP); (III) Qualidade (eSF, eAP, eSB e eMulti); (IV) Implantação/manutenção de programas e composições adicionais de equipe; (V) Saúde Bucal (eSB, UOM, CEO, LRPD, SESB); e (VI) Per capita populacional para ações de APS.

Até dezembro de 2025 todos os municípios recebem classificação "BOM" no Componente Qualidade, independentemente da nota real. **A partir de 2026, a classificação passa a refletir o desempenho efetivo das equipes** — o que torna o monitoramento contínuo desses indicadores pelo SIMPA particularmente relevante para Americana a partir desta competência.

### 13.2 Indicadores do Componente de Qualidade

| Bloco | Código | Indicador | Fonte no SIMPA |
|---|---|---|---|
| eSF/eAP | **C1** | Acesso e Vínculo — proporção de 1ªs consultas programadas vs. atendimentos de demanda espontânea | Relatório de Atendimento Individual (seção "Tipo de atendimento"/"Turno") |
| eSF/eAP | — | Acompanhamento de pessoas com Hipertensão e Diabetes (HAS/DM) | Relatório de Atendimento Individual (seções de condições avaliadas/conduta) |
| eSF/eAP | — | Cobertura de citopatológico (Papanicolau) e gestantes com pré-natal iniciado no 1º trimestre | Relatório de Atendimento Individual (seções de procedimentos/grupos) |
| eSF/eAP | — | Avaliação Multidimensional da Pessoa Idosa | Relatório de Atendimento Individual (faixa etária + procedimento específico) |
| eSB | **B1** | 1ª consulta odontológica programada na APS | Relatório de Atendimento Odontológico |
| eSB | **B2** | Tratamentos odontológicos concluídos | Relatório de Atendimento Odontológico |
| eSB | **B3** | Taxa de exodontias na APS | Relatório de Procedimentos Individualizados (procedimentos odontológicos) |
| eSB | **B4** | Escovação supervisionada (6 a 12 anos) | Relatório de Atividade Coletiva (temas/faixa etária) |
| eSB | **B5** | Procedimentos preventivos odontológicos | Relatório de Procedimentos Individualizados |
| eSB | **B6** | Tratamento Restaurador Atraumático (ART) | Relatório de Procedimentos Individualizados |
| eMulti | **M1** | Média de atendimentos (individuais + coletivos) por pessoa assistida pela eMulti | Relatórios de Atendimento Individual + Atividade Coletiva |
| eMulti | **M2** | Proporção de ações interprofissionais compartilhadas pela eMulti | Relatório de Atividade Coletiva |

Esses indicadores alimentam o bloco `modulos.financiamento_metas.componente_qualidade_aps` do contrato (Seção 5). Na Fase 1, o cálculo pode ser feito a partir de `esus_indicadores_raw` via consultas SQL/ETL; metas oficiais (quando publicadas pelo Ministério da Saúde/SAPS) podem ser cadastradas manualmente em uma tabela de referência (`metas_financiamento`, a detalhar na Fase 2).

### 13.3 IGM SUS Paulista

O **Índice de Gestão Municipal Paulista (IGM SUS Paulista)** é o mecanismo do Governo do Estado de São Paulo que transfere recursos a todos os municípios para ações de Atenção Primária e Vigilância Epidemiológica. A partir de 2026 o programa passa a ter dois componentes — **fixo** e **variável** —, sendo o variável calculado conforme o desempenho municipal em indicadores como:

- Cobertura de Atenção Primária (eSF/eAP), apurada via cadastro territorial do e-SUS;
- Proporção de gestantes com 7 ou mais consultas de pré-natal;
- Cobertura vacinal de menores de 1 ano (calendário básico — Pentavalente, VIP, Pneumocócica etc.);
- Taxa de **ICSAP** (Internações por Condições Sensíveis à Atenção Primária) — cruzamento e-SUS + SIHD, refletindo a resolutividade da APS na redução de internações evitáveis (ex.: descompensação de HAS/DM, asma, desidratação).

Esses indicadores alimentam `modulos.financiamento_metas.igm_sus_paulista` no contrato. Diferente do bloco federal, parte dos dados (cobertura vacinal e ICSAP) depende de fontes hoje fora do escopo do Módulo 1 (sistema de imunização e SIHD/AIH) — tratar como indicadores "parcialmente apurados" na Fase 1, evoluindo conforme a integração desses módulos avança (Seção 8).

### 13.4 Tabela SUS Paulista (Cofinanciamento Estadual SIA/SIHD)

A **Tabela SUS Paulista** é o principal mecanismo estadual de complementação de valores pagos a prestadores SUS para procedimentos de média e alta complexidade. O Tesouro do Estado complementa, mensalmente, o valor da Tabela SIGTAP nacional até o valor da Tabela SUS Paulista, **com base exclusivamente na produção aprovada registrada no SIA e no SIHD**.

Para o SIMPA, isso significa que a própria produção já ingerida nos Módulos 1 (e-SUS/SIA) e 4 (SIHD) pode ser cruzada contra uma tabela de referência de valores complementares (a ser carregada/atualizada periodicamente) para estimar o **valor de cofinanciamento estadual gerado pelo município**, alimentando `modulos.financiamento_metas.tabela_sus_paulista`. Esse cruzamento é um candidato natural para a Fase 2/3, dependente da disponibilização da tabela de valores complementares pela SES/SP.

### 13.5 Oferta de Cuidados Integrados (OCI) e PMAE

**OCI (Oferta de Cuidados Integrados)** é o conceito central do **Programa Mais Acesso a Especialistas (PMAE)**, instituído pela Portaria SAES/MS nº 1.822/2024: um conjunto de procedimentos (consultas, exames e tecnologias de cuidado) organizados regionalmente para completar uma etapa de uma linha de cuidado ou o manejo de um agravo específico, com referência e contrarreferência seguras e transição planejada para a APS. As OCIs são pactuadas regionalmente (CIR/CIB) e monitoradas por painel próprio do Ministério da Saúde (Painel de Produção OCI — `controleavaliacao.saude.gov.br/painel/oci`).

> **Nota de alinhamento:** a versão inicial deste PRD (Seção 7.4) cita um "modelo OCI Regional" como referência **visual/de interface** do dashboard. Após esta pesquisa, recomenda-se que a equipe valide com a Unidade de Planejamento qual sentido é o pretendido — (a) referência de **UI/UX** de algum painel regional já em uso, ou (b) o conceito de **Oferta de Cuidados Integrados** acima, que é o significado padronizado pelo Ministério da Saúde no contexto de Média/Alta Complexidade (Módulo 1 — SIA/SUS). Para fins de modelagem de dados, o SIMPA pode incorporar o sentido (b): agrupar os procedimentos SIGTAP do SIA por **linha de cuidado/OCI pactuada**, permitindo um painel de "execução de OCI" análogo ao oficial, mas com granularidade municipal/equipe — útil tanto para benchmarking (Módulo 3) quanto para acompanhamento de emendas vinculadas a especialidades (Seção 14).

---

## 14. Acompanhamento de Emendas Parlamentares

### 14.1 Marco Regulatório

A partir de 2025, as transferências de **emendas parlamentares ao SUS** (individuais, de bancada e de comissão) passaram a ser regidas pela Portaria GM/MS nº 6.904/2025 (que substituiu a Portaria GM/MS nº 6.870/2025), editada em conformidade com a Lei Complementar nº 210/2024 e decisões do STF sobre execução de emendas. A norma exige, para cada emenda destinada à saúde:

- **Plano de trabalho obrigatório**, com descrição do objeto, justificativa, metas físicas e detalhamento da aplicação dos recursos;
- Uso obrigatório dos sistemas **Ambiente Parlamentar** (indicação da emenda) e **InvestSUS** (acompanhamento e monitoramento de beneficiários e propostas) pelo Fundo Nacional de Saúde;
- Áreas de aplicação estruturantes: Atenção Primária, Atenção Especializada, Saúde Indígena, Saúde Digital e Vigilância em Saúde.

Emendas **estaduais** (Governo de SP) e **municipais** (Câmara Municipal de Americana) seguem fluxos próprios de transparência — Portal da Transparência do Estado de SP (`transparencia.sp.gov.br/home/emendasparlamentares`) e o portal de transparência municipal — mas, na prática, convergem para o mesmo destino contábil: o **Fundo Municipal de Saúde**, com metas físicas que se traduzem em produção registrada no **SIA** (procedimentos ambulatoriais/SIGTAP) ou no **SIHD** (AIHs, cirurgias, internações).

### 14.2 Modelo de Dados e Fluxo no SIMPA

O SIMPA não substitui o Ambiente Parlamentar/InvestSUS como sistema de registro — ele **referencia** essas emendas e **cruza suas metas físicas com a produção real** já ingerida pelos Módulos 1/4. Proposta de modelo (Fase 2, a detalhar em DDL próprio quando priorizado):

- **`emendas_parlamentares`** — 1 linha por emenda: esfera (`federal`/`estadual`/`municipal`), tipo (individual/bancada/comissão/especial), autor, número/identificador no Ambiente Parlamentar ou InvestSUS, objeto, valor repassado, status (empenhado/pago/em execução).
- **`emendas_metas_producao`** — 1 ou mais linhas por emenda: vínculo com código(s) SIGTAP (procedimento SIA) ou capítulo CID/grupo de procedimento (SIHD), meta física pactuada (quantidade), unidade/equipe de referência (quando aplicável), e período de vigência.
- **ETL de cruzamento (mensal):** para cada `emenda_meta_producao`, soma a produção real do período (a partir de `esus_indicadores_raw`/dados SIA/SIHD já carregados) que corresponda aos códigos vinculados, calculando `executado_fisico` e `percentual_execucao` — populando o bloco `emendas_parlamentares` do contrato (Seção 5).

Na Fase 1, o cadastro de emendas e suas metas pode ser feito **manualmente** pela Unidade de Planejamento (planilha → carga simples), enquanto o cruzamento com a produção já é automatizado pelo pipeline existente.

### 14.3 Fontes de Consulta Pública (Referência)

| Esfera | Sistema/Painel | Uso pelo SIMPA |
|---|---|---|
| Federal | **InvestSUS** (`investsuspaineis.saude.gov.br`) e Painel de Emendas (CGIN) | Conferência de instrumentos, empenhos e pagamentos por beneficiário |
| Federal | Portal da Transparência (Tesouro Transparente — Painel de Emendas Individuais e de Bancada) | Validação cruzada de valores repassados |
| Federal | Siga Brasil (Senado) | Histórico orçamentário desde 2004 |
| Estadual (SP) | Portal da Transparência SP — Emendas Parlamentares | Emendas estaduais destinadas a Americana |
| Municipal | Portal da Transparência da Câmara/Prefeitura de Americana | Emendas municipais ao Fundo Municipal de Saúde |

Esses painéis são **fontes de verificação**, não de integração automática na Fase 1 — o cadastro no SIMPA é alimentado manualmente a partir desses portais, com o diferencial do SIMPA sendo o **cruzamento automático da meta declarada com a produção SIA/SIHD do município**, algo que nenhum dos painéis acima oferece de forma nativa.

---

## 15. Glossário

| Sigla / Termo | Significado |
|---|---|
| **SIMPA** | Sistema Integrado de Monitoramento e Planejamento de Americana |
| **BI** | Business Intelligence |
| **e-SUS APS** | Sistema Eletrônico do Sistema Único de Saúde — Atenção Primária à Saúde |
| **eSF / EAP** | Equipe de Saúde da Família / Equipe de Atenção Primária |
| **SIA/SUS** | Sistema de Informações Ambulatoriais do SUS |
| **SIHD/SUS** | Sistema de Informações Hospitalares Descentralizado do SUS |
| **AIH** | Autorização de Internação Hospitalar |
| **SIGTAP** | Sistema de Gerenciamento da Tabela de Procedimentos, Medicamentos e OPM do SUS |
| **CID** | Classificação Internacional de Doenças |
| **CNES** | Cadastro Nacional de Estabelecimentos de Saúde |
| **CAFI** | Centro de Assistência à Família e ao Idoso |
| **UPA** | Unidade de Pronto Atendimento |
| **JSONB** | Tipo de dado binário do PostgreSQL para armazenamento de JSON, indexável |
| **GIN** | Generalized Inverted Index — tipo de índice do PostgreSQL otimizado para JSONB |
| **LGPD** | Lei Geral de Proteção de Dados (Lei nº 13.709/2018) |
| **MVP** | Minimum Viable Product (Produto Mínimo Viável) |
| **OCI Regional** | Referência de interface gráfica citada na concepção inicial do SIMPA (Seção 7.4) — a validar com a Unidade de Planejamento frente ao conceito de OCI da Seção 13.5 |
| **IED** | Índice de Equidade e Dimensionamento — usado no cálculo do Componente Fixo do novo financiamento federal da APS (Portaria GM/MS nº 3.493/2024) |
| **Componente Qualidade** | Parte do cofinanciamento federal da APS vinculada ao desempenho em indicadores de eSF/eAP, eSB (B1-B6) e eMulti (M1/M2) |
| **B1–B6** | Indicadores de saúde bucal do Componente Qualidade (acesso, tratamento concluído, exodontias, escovação supervisionada, preventivos, ART) |
| **M1 / M2** | Indicadores de eMulti do Componente Qualidade (média de atendimentos por pessoa assistida; ações interprofissionais compartilhadas) |
| **IGM SUS Paulista** | Índice de Gestão Municipal Paulista — programa estadual (SP) de repasse a municípios com componente fixo e variável por desempenho em saúde |
| **Tabela SUS Paulista** | Tabela de cofinanciamento estadual (SP) que complementa os valores SIGTAP para procedimentos aprovados via SIA/SIHD |
| **ICSAP** | Internações por Condições Sensíveis à Atenção Primária — indicador de resolutividade da APS (cruzamento e-SUS + SIHD) |
| **OCI (Oferta de Cuidados Integrados)** | Conjunto de procedimentos/tecnologias organizados regionalmente para completar uma linha de cuidado, conceito-chave do PMAE (Portaria SAES/MS nº 1.822/2024) |
| **PMAE** | Programa Mais Acesso a Especialistas — programa federal de qualificação da atenção ambulatorial especializada (Média/Alta Complexidade) |
| **InvestSUS / Ambiente Parlamentar** | Sistemas obrigatórios do Fundo Nacional de Saúde para indicação, acompanhamento e monitoramento de emendas parlamentares destinadas ao SUS |

---

*Documento vivo — sujeito a revisão conforme alinhamento com TI municipal, jurídico/LGPD e validação das unidades-piloto.*