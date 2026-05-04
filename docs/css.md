# Especificações Técnicas: CSS Global e Pipeline Adaptativo

Esta documentação descreve a arquitetura de estilos vigente no módulo web principal, usada como base de compatibilidade para migração do BI.

## Implementação no projeto (referência atual)

| Peça | Caminho no repositório |
| :--- | :--- |
| Tokens e temas (dark/light/green/blue), classes visuais e estados | `NOVO BI/web/src/index.css` |
| Registro de temas e aplicação da classe no `<html>` | `NOVO BI/web/src/theme/tokens.ts` |
| Entrada React (aplica tema padrão no bootstrap) | `NOVO BI/web/src/main.tsx` |
| Classe inicial de tema no HTML | `NOVO BI/web/index.html` |
| Gráficos (containers e wrappers atuais) | `NOVO BI/web/src/components/charts/BICanvasContainer.tsx`, `EChartCanvas.tsx`, `MiniBarChart.tsx` |
| Exemplo de consumo dos tokens no shell gerencial | `NOVO BI/web/src/components/gerencial/*` |

`index.html` inicia com `class="theme-dark"` e o bootstrap (`main.tsx`) reaplica `defaultTheme` via `applyTheme(...)`.

---

## 1. Fundação: Design Tokens (OKLCH + semântica)

Os tokens centrais ficam em `NOVO BI/web/src/index.css`, com base em OKLCH para cores estruturais e hex quando necessário.

### Variáveis core

Definidas em `:root, .theme-dark` e sobrescritas por tema (`.theme-light`, `.theme-green`, `.theme-blue`):

- `--background`, `--foreground`, `--primary`, `--accent`
- **Pipeline (dashboard):** `--dash-panel`, `--dash-live`, `--dash-critical`, `--dash-accent-urgent`
- **App shell:** `--app-bg`, `--app-surface`, `--app-elevated`, `--app-border`, `--app-fg`, `--app-muted`
- **Tabela/grade:** `--table-grid`, `--table-grid-strong`, `--table-row-sep`, `--table-header-from`, `--table-header-to`, `--table-header-fg`, `--table-header-muted`

### Por que funciona

Os componentes renderizam com `var(--*)`, e a troca da classe no `<html>` (`theme-dark` ↔ `theme-light` etc.) muda o tema sem reescrever os componentes.

---

## 2. Orquestração de temas (vigente)

O controle de tema fica em `NOVO BI/web/src/theme/tokens.ts`:

| Tema | Classe HTML | Efeito principal |
| :--- | :--- | :--- |
| Dark (padrão) | `.theme-dark` | Base escura do BI operacional. |
| Light | `.theme-light` | Fundo claro com alto contraste textual. |
| Green | `.theme-green` | Acentos verdes em `primary/accent`. |
| Blue | `.theme-blue` | Acentos azuis em `primary/accent`. |

`main.tsx` aplica `defaultTheme` no carregamento inicial. No estado atual, o módulo não depende de `ThemeProvider`/`ThemeContext` nem de persistência por `localStorage`.

---

## 3. Padrão "Pipeline" (dashboard)

Paleta operacional do pipeline, tokenizada:

- **Painel:** `--dash-panel` (`#1e2030` no tema dark)
- **Live (teal):** `--dash-live` (`#2de0b9`)
- **Crítico (red):** `--dash-critical` (`#e02d5f`)
- **Urgente (amber):** `--dash-accent-urgent` (`#e0b92d`)

A classe `.dashboard-panel` usa estes tokens para fundo/borda e mantém consistência visual entre tabelas e cards de gerência.

---

## 3.1 Gráficos (estado atual)

| Peça | Função |
| :--- | :--- |
| `EChartCanvas` | Wrapper de `echarts-for-react` para line chart de referência. |
| `MiniBarChart` | Exemplo Recharts usando tokens (`var(--primary)`). |
| `BICanvasContainer` | Container de dashboard com cards e integração dos dois gráficos de preview. |

Padrão recomendado para novos gráficos:

1. Consumir tokens via `var(--*)` (`--table-grid`, `--dash-live`, `--app-muted`, etc.).
2. Evitar hardcode de cor quando existir token semântico equivalente.
3. Manter o gráfico dentro de containers semânticos (`dashboard-panel`, `glass-card`).

---

## 4. Adaptação de tela e layout

Em `index.css`:

- `html`, `body` e `#root` com `max-width: 100%` e `overflow-x: clip`
- fundo global unificado por `var(--app-bg)` para evitar quebra de tom entre áreas
- cards e painéis com blur/sombra graduais via `color-mix(...)`

Opcional em módulos de wallboard:

```css
.multi-monitor-extended-view {
  font-size: clamp(16px, 1.5vw, 24px) !important;
}
```

---

## 5. Estados de interface

Estados visuais recomendados (com tokens):

- **Carregamento:** usar acento `--dash-live`
- **Erro:** usar `--dash-critical`
- **Ênfase de ação:** usar `--primary` com variações por `color-mix`
- **Cards urgentes:** priorizar `--dash-accent-urgent`

---

## 6. Acessibilidade e movimento reduzido

Manter `@media (prefers-reduced-motion: reduce)` no `index.css` para reduzir efeitos não essenciais e transições longas, preservando legibilidade e foco operacional.

---

## 7. Compatibilidade para migração BI -> aplicação principal (VM)

Para evitar conflito de tema na migração:

1. Consumir apenas tokens semânticos (`var(--*)`), nunca cores fixas como base do layout.
2. Usar classes de tema vigentes (`theme-dark`, `theme-light`, `theme-green`, `theme-blue`).
3. Não depender de `ThemeContext`, `ThemeProvider` ou `tailwind.config.js` legado.
4. Em gráficos, priorizar tokens de contraste/eixos e reservar hardcode apenas para escalas analíticas específicas.

---

## 8. Como estender sem quebrar padrão

1. Novos tokens: editar `NOVO BI/web/src/index.css`.
2. Novos temas: incluir classe em `index.css` e registrar em `NOVO BI/web/src/theme/tokens.ts`.
3. Novos componentes: preferir classes e tokens semânticos (`dashboard-panel`, `glass-card`, `var(--app-surface)`).
4. Revisar contraste em tema claro e escuro antes de publicar.
