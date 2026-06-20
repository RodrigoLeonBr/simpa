# SIMPA — Design System

> **Fonte de verdade para todas as telas.** Toda nova tela, componente ou modificação visual DEVE seguir este documento. Não use cores, fontes ou espaçamentos arbitrários — use os tokens definidos aqui.

---

## 1. Fontes

```html
<!-- Adicionar no <head> de index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

| Uso | Fonte | Peso |
|-----|-------|------|
| UI geral (labels, parágrafos, botões) | IBM Plex Sans | 400 / 500 / 600 / 700 |
| Números, KPIs, códigos, tags mono | IBM Plex Mono | 400 / 500 / 600 |

**Regra:** Qualquer valor numérico exibido como KPI, tabela ou badge de código usa `font-family: 'IBM Plex Mono'`. Nunca `font-family: monospace` genérico.

---

## 2. Tokens de cor — CSS custom properties

Definir em `src/index.css`:

```css
:root {
  /* === LIGHT MODE (padrão) === */

  /* Backgrounds */
  --bg-app:       #eef2f7;
  --bg-card:      #ffffff;
  --bg-sidebar:   #0c2236;
  --bg-topbar:    #ffffff;
  --bg-filterbar: #ffffff;
  --bg-input:     #f7f9fc;

  /* Bordas */
  --border:       #e2e9f1;
  --border-input: #dde5ee;

  /* Texto */
  --text-primary: #0f1b2d;
  --text-secondary: #5a6b80;
  --text-muted:   #8595a8;
  --text-sidebar: #9fb3c8;
  --text-sidebar-active: #ffffff;

  /* Brand */
  --brand:        #0b5fad;
  --brand-hover:  #0a528f;
  --brand-bg:     #e7eef6;

  /* Status */
  --green:        #1f8a5b;
  --green-bg:     #e6f3ec;
  --amber:        #c8862b;
  --amber-bg:     #fbf0dd;
  --red:          #c0392b;
  --red-bg:       #fbe6e3;

  /* Sidebar nav item ativo */
  --sidebar-active-bg: #0b5fad;

  /* Scrollbar */
  --scrollbar-thumb: #c3cedb;
}

[data-theme="dark"] {
  /* === DARK MODE === */

  /* Backgrounds */
  --bg-app:       #070f1c;
  --bg-card:      #0e1a2e;
  --bg-sidebar:   #050c18;
  --bg-topbar:    #0a1525;
  --bg-filterbar: #0a1525;
  --bg-input:     #0d1b2e;

  /* Bordas */
  --border:       #1c2c44;
  --border-input: #21374f;

  /* Texto */
  --text-primary: #eaf1fa;
  --text-secondary: #8499b3;
  --text-muted:   #6f86a3;
  --text-sidebar: #9fb3c8;
  --text-sidebar-active: #ffffff;

  /* Brand (igual) */
  --brand:        #0b5fad;
  --brand-hover:  #3b9bff;
  --brand-bg:     #13243c;

  /* Status (igual) */
  --green:        #1f8a5b;
  --green-bg:     #0d2318;
  --amber:        #c8862b;
  --amber-bg:     #1e1507;
  --red:          #c0392b;
  --red-bg:       #200d0b;

  /* Sidebar nav item ativo */
  --sidebar-active-bg: #0b5fad;

  /* Scrollbar */
  --scrollbar-thumb: #21374f;
}
```

---

## 3. Layout shell

```
┌──────────────────────────────────────────────────────┐
│ [236px sidebar]  │ [topbar 58px                      ]│
│                  ├───────────────────────────────────┤
│  Logo (48×48)    │ [filterbar sticky (se aplicável)  ]│
│  ─────────────   │                                   │
│  Nav items       │  <main> overflow-auto             │
│  (ícone+label)   │    padding: 22px                  │
│                  │                                   │
│  ─────────────   │                                   │
│  v0.x · Fase N   │                                   │
│  ETL · SIA       │                                   │
└──────────────────┴───────────────────────────────────┘
```

**Sidebar:**
- Largura: `236px`, sempre visível (sem colapso)
- Background: `var(--bg-sidebar)` — nunca muda entre temas
- Logo: `<img src="/logo.png" onerror="this.style.display='none';this.nextSibling.style.display='flex'" />` + monograma fallback
- Item ativo: `background: var(--sidebar-active-bg)`, `color: var(--text-sidebar-active)`
- Item inativo: `color: var(--text-sidebar)`, hover `background: #14304e`
- Badge: `background: var(--brand)`, `color: #fff`, `border-radius: 20px`, `font-family: IBM Plex Mono`

**Topbar:**
- Altura: `58px`, `background: var(--bg-topbar)`, `border-bottom: 1px solid var(--border)`
- Esquerda: título (16px, weight 600) + breadcrumb (11px, `var(--text-muted)`)
- Direita: botão "Sala de Situação" + separador + avatar perfil + logout + theme toggle

**FilterBar (sticky):**
- `background: var(--bg-filterbar)`, `border-bottom: 1px solid var(--border)`
- `position: sticky; top: 0; z-index: 5`
- Selects: `background: var(--bg-input)`, `border: 1.5px solid var(--border-input)`, `border-radius: 8px`

---

## 4. Cards

```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 13px;
  padding: 16px 18px;
}
```

- Border-radius padrão: **13px** (cards grandes), **9px** (inputs, botões pequenos), **8px** (badges inline)
- Sombra: apenas hover em cards clicáveis — `box-shadow: 0 4px 14px rgba(11,95,173,.08)`
- **Nunca** usar `box-shadow` em cards estáticos

---

## 5. Tipografia — escala

| Uso | Tamanho | Peso | Cor |
|-----|---------|------|-----|
| Título de página | 19px | 700 | `var(--text-primary)` |
| Título de seção (card header) | 14–15px | 600 | `var(--text-primary)` |
| Body / labels | 12.5–13px | 400/500 | `var(--text-secondary)` |
| Labels uppercase (filtros) | 11px | 600 | `var(--text-muted)` + `letter-spacing: .5px` |
| KPI value | 28–34px | 600 | `var(--text-primary)` + IBM Plex Mono |
| KPI value hero | 42px | 600 | `var(--text-primary)` + IBM Plex Mono |
| Badge / tag | 10–11px | 600 | (depende do contexto) + IBM Plex Mono |
| Rodapé sidebar | 10.5px | 400 | `var(--text-muted)` + IBM Plex Mono |

---

## 6. Botões

| Tipo | Background | Texto | Border-radius |
|------|-----------|-------|--------------|
| Primary | `var(--brand)` | `#fff` | 9px |
| Primary hover | `var(--brand-hover)` | `#fff` | 9px |
| Secondary | `var(--brand-bg)` | `var(--brand)` | 8px |
| Secondary hover | `var(--brand)` | `#fff` | 8px |
| Ghost | transparent | `var(--text-secondary)` | 8px |
| Ghost hover | `var(--border)` | `var(--text-primary)` | 8px |
| Danger | transparent | `var(--red)` | 8px |
| Danger hover | `var(--red-bg)` | `var(--red)` | 8px |

---

## 7. Status badges

```
Atingida / OK / Ativo:   bg var(--green-bg),  text var(--green)
Próxima / Alerta:        bg var(--amber-bg),  text var(--amber)
Abaixo / Erro / Inativo: bg var(--red-bg),    text var(--red)
Processando / Pendente:  bg var(--brand-bg),  text var(--brand)
Neutro / Info:           bg var(--border),    text var(--text-muted)
```

Border-radius: **20px** (pill). Font: IBM Plex Mono 10–11px, weight 600. Padding: `2px 9px`.

---

## 8. Tabelas

```css
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
thead tr {
  background: var(--bg-app);  /* cinza claro / dark app */
  color: var(--text-secondary);
  text-align: left;
}
th { padding: 10px 18px; font-weight: 600; }
td { padding: 10px 18px; border-top: 1px solid var(--border); }
tr:hover { background: var(--bg-app); }
```

Primeira coluna de dados numéricos: IBM Plex Mono, `text-align: right`.

---

## 9. Progress bars (Metas / Indicadores)

```css
.progress-track {
  height: 8–14px;           /* 8px compacto, 14px destacado */
  border-radius: 6px;
  background: var(--border);
  position: relative;
  overflow: visible;         /* para o marcador de meta sair da track */
}
.progress-fill {
  height: 100%;
  border-radius: 6px;
  background: [verde/âmbar/vermelho conforme status];
}
.progress-meta-marker {
  position: absolute;
  top: -3px; bottom: -3px;
  width: 2.5px;
  background: var(--text-primary);
  left: [metaW%];
}
```

Nunca tratar `null` como `0`. Exibir `—` com badge âmbar "Não apurado" quando valor é `null`.

---

## 10. Gráficos ECharts — configuração base

Aplicar em todos os gráficos:

```typescript
const baseTheme = {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
  grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
  tooltip: { trigger: 'axis' },
  xAxis: {
    axisLine: { lineStyle: { color: 'var(--border)' } },
    axisLabel: { color: 'var(--text-muted)', fontSize: 9 },
  },
  yAxis: {
    splitLine: { lineStyle: { color: 'var(--border)' } },
    axisLabel: { color: 'var(--text-muted)', fontSize: 9 },
  },
};

// Cor de linha por contexto:
// Primária:  var(--brand)    = #0b5fad
// Positiva:  var(--green)    = #1f8a5b
// Negativa:  var(--red)      = #c0392b
// Meta:      var(--text-primary) com stroke-dasharray 5,5
```

Área sob a linha: gradiente de 22% a 0% da cor da linha.

---

## 11. Animações

```css
@keyframes simpaRise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

/* Aplicar em toda troca de tela/conteúdo */
.page-enter { animation: simpaRise .25s ease both; }
```

---

## 12. Logo — regras de uso

- **Arquivo:** `simpa-frontend/public/logo.png` (a ser fornecido)
- **Dimensões na sidebar:** `48×48px`, `border-radius: 11px`
- **Fallback:** Monograma "S" em `background: var(--brand)`, `color: #fff`, `font-weight: 700`
- **Nunca** distorcer ou recolorizar o logo
- **Nunca** usar logo em fundo que não seja `var(--bg-sidebar)` ou fundo branco

```tsx
// Componente Logo (padrão para todas as telas)
function Logo() {
  const [fallback, setFallback] = useState(false);
  if (fallback) return (
    <div style={{ width:48, height:48, borderRadius:11, background:'var(--brand)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:700, fontSize:19, color:'#fff', letterSpacing:'-.5px' }}>S</div>
  );
  return <img src="/logo.png" width={48} height={48}
    style={{ borderRadius:11, objectFit:'contain' }}
    onError={() => setFallback(true)} />;
}
```

---

## 13. Scrollbar

```css
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 6px;
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-track { background: transparent; }
```

---

## 14. Nomenclatura — termos proibidos na UI

| Não usar | Usar |
|----------|------|
| CRUD | Cadastro |
| Delete | Inativar (soft delete) / Excluir (hard delete com confirmação) |
| Submit | Salvar / Confirmar / Processar |
| Error | Erro / Não disponível |
| N/A | — (traço em IBM Plex Mono) |
| null | — com badge âmbar "Não apurado" |

---

## 15. Checklist para novas telas

Antes de marcar qualquer tela como pronta, verificar:

- [ ] Usa `var(--bg-app)` como fundo da página
- [ ] Cards usam `var(--bg-card)` + `border: 1px solid var(--border)` + `border-radius: 13px`
- [ ] Números/KPIs usam IBM Plex Mono
- [ ] Títulos de página: 19px weight 700 `var(--text-primary)`
- [ ] Valores `null` renderizados como `—` (nunca zero)
- [ ] Status badges seguem a paleta verde/âmbar/vermelho definida
- [ ] Animação `simpaRise` aplicada na entrada da tela
- [ ] Funciona em light mode E dark mode (sem cores hardcoded)
- [ ] FilterBar sticky se a tela tem filtros
- [ ] Tabelas: hover `var(--bg-app)`, header `var(--text-secondary)`
