# Especificações Técnicas: CSS Global e Pipeline Adaptativo

Esta documentação detalha a arquitetura de estilos que permite que as aplicações do sistema se ajustem automaticamente, utilizando variáveis CSS, o espaço de cor OKLCH e técnicas de escalonamento dinâmico.

## Implementação no Novo BI (referência)

| Peça | Caminho no repositório |
| :--- | :--- |
| Tokens, temas, animações pipeline | `frontend/src/index.css` |
| Registro Tailwind (`app.*`, `pipeline.*`, `table.*`, keyframes) | `frontend/tailwind.config.js` |
| Estado de tema no `<html>` + persistência | `frontend/src/context/ThemeContext.jsx` |
| Seletor de tema (Geral escuro/claro, PS, Leitos) | `frontend/src/components/ThemeSwitcher.jsx` |
| Entrada React | `frontend/src/main.jsx` (ThemeProvider) |

O `index.html` inicia com `class="h-full dark"` para evitar flash; o `ThemeProvider` reaplica a classe salva no `localStorage` (`hospital-bi-theme`).

---

## 1. Fundação: Design Tokens (OKLCH)

O sistema utiliza variáveis no espaço de cor **OKLCH** (com fallbacks hex onde necessário), alinhado ao padrão descrito para **Tailwind 4**; neste projeto o build é **Tailwind 3** com as mesmas variáveis consumidas via `var(--*)` e classes `bg-app-*`, `text-app-*`, `pipeline-*`.

### Variáveis Core (`:root` + temas)

Definidas em `frontend/src/index.css` em `:root`, `.dark`, `.light`, `.dark-green`, `.dark-blue`:

- `--background`, `--foreground`, `--primary`, `--accent`
- **Pipeline (dashboard):** `--dash-panel`, `--dash-live`, `--dash-critical`, `--dash-accent-urgent`
- **App shell:** `--app-bg`, `--app-surface`, `--app-elevated`, `--app-border`, `--app-fg`, `--app-muted`
- **Tabelas Gerência (por tema):** `--table-grid`, `--table-grid-strong`, `--table-row-sep`, `--table-thead-b`, `--table-total-sep`, `--table-header-from` / `--table-header-to`, `--table-head-inset`, `--table-subhead-bg`, `--table-header-fg`, `--table-header-muted`, `--table-zebra-odd` / `--table-zebra-even`, `--table-row-hover`, `--table-sticky-a|b|c`, `--table-total-bg`, `--table-footer-bg`, `--table-footer-b`, `--table-head-metric-bg`, `--table-cell-neutral`, `--table-nested-bg`
- `--radius`, `--font-sans`, scrollbar tokens

Classes utilitárias Tailwind (`tailwind.config.js`): `border-table-grid`, `bg-table-zebra-odd`, `text-table-header-fg`, etc.

Componentes CSS: `.table-head-gradient`, `.table-subhead-row`, `.app-transition` (transições leves; encurtadas com `prefers-reduced-motion`), **`.gerencia-panel-head`** (faixa de título dos painéis Gerência: gradiente primary + teal, barra vertical `--dash-live` → `--primary`).

### Por que isto funciona?

Qualquer componente que use `var(--primary)` ou classes Tailwind mapeadas (`bg-app-bg`) atualiza quando a classe no `<html>` muda (`.dark` → `.light`, etc.).

---

## 2. Orquestração de Temas (Theming)

O **`ThemeProvider`** (`frontend/src/context/ThemeContext.jsx`) remove/adiciona no `document.documentElement` uma entre:

| Tema | Classe HTML | Efeito principal |
| :--- | :--- | :--- |
| **Light** | `.light` | Fundo claro, painéis brancos/cinza claro. |
| **Dark (Padrão)** | `.dark` | Base escura tipo BI atual (slate). |
| **Dark Green** | `.dark-green` | Tons verdes (referência PS / comando). |
| **Dark Blue** | `.dark-blue` | Azul marinho (referência Leitos). |

Sobrescrita via blocos CSS no mesmo `index.css` (técnica da documentação original).

---

## 3. O Padrão "Pipeline" (Dashboard)

Paleta fixa replicada em variáveis:

* **Fundo do painel:** `#1e2030` → `--dash-panel` (ajustado no tema claro)
* **Acento Live (Teal):** `#2DE0B9` → `--dash-live` (ex.: botão atualizar, loading dots, tema ativo)
* **Acento Crítico (Red):** `#E02D5F` → `--dash-critical`
* **Acento Urgente (Amber):** `#E0B92D` → `--dash-accent-urgent`

Classe utilitária **`.dashboard-panel`** aplica fundo/borda alinhados ao pipeline nas tabelas Gerência (`MetasPorVolumesTable`, `MetricasPorUnidadeTable`, `TempoMedioEtapasTable`), com **sombra interna** suave derivada de `--primary` e ajustes por `.light`, `.dark-green`, `.dark-blue`.

---

## 4. Adaptação Automática de Tela (Responsive Scale)

### A. Tipografia fluida (`clamp`)

Classe opcional no root quando necessário (wallboard):

```css
.multi-monitor-extended-view {
  font-size: clamp(16px, 1.5vw, 24px) !important;
}
```

### B. Variável de escala local (`--unit-card-scale`)

Pode ser adicionada aos cards densos:

```css
.unit-card-typography {
  font-size: calc(1rem * var(--unit-card-scale, 1));
}
```

### C. Layout “clip”

Em `index.css` (`@layer base`):

- `html`: `max-width: 100vw`, `overflow-x: clip`
- `#root`: `min-width: 0` (flex/grid encolhem corretamente)

---

## 5. Estados de interface (carregamento, erro, sucesso)

| Estado | Implementação sugerida |
| :--- | :--- |
| **Carregamento** | `.state-loading-dot` (bounce + glow teal) no `SectionLoader` (`App.jsx`) |
| **Erro API** | `.state-error-banner` nas tabelas (borda/cor crítica) |
| **Transição de rota** | `.animate-fade-in-up` no shell principal |
| **Crítico / Urgente (cards)** | `.card-critico`, `.card-urgente` (`index.css`) |

---

## 6. Acessibilidade: movimento reduzido

Em `frontend/src/index.css`, `@media (prefers-reduced-motion: reduce)` desliga animações decorativas (fade-in do shell, spin lento, foguinho/raio, glow, bounce/ping/pulse nos loaders) e encurta `.app-transition`, `.nav-item` e `.card-premium`. Em componentes, use `motion-reduce:*` (Tailwind 3.4) quando fizer sentido — ex.: `Sidebar` com `motion-reduce:transition-none` na largura colapsável.

---

## 7. Gadgets e Micro-Interações

Classes e keyframes disponíveis em `index.css` e, para uso via Tailwind, em `tailwind.config.js`:

- **`.anim-foguinho`**, **`.anim-raio`** — atenção sem fadiga
- **`.anim-glow-pulse`**, **`.anim-preview-pulse`**
- **`.animate-spin-slow`** — relógio / indicador contínuo

---

## 8. Como estender

1. Novos tokens: edite `index.css` e, se precisar de utilitário Tailwind, `tailwind.config.js`.
2. Novos temas: adicione classe no `<html>` + bloco em `index.css`; inclua o nome em `THEMES` em `ThemeContext.jsx` e botão em `ThemeSwitcher.jsx`.
3. Preferir **cores semânticas** (`bg-app-surface`) em novos componentes em vez de `bg-slate-*` fixo, para respeitar todos os temas.
