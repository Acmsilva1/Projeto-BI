# ⚡ SKILL: THE FRONT-END STACK (SOLO AGENT)

## 🛠 CORE TECH STACK (A BÍBLIA)
Sempre que este arquivo for lido, ignore qualquer sugestão de biblioteca externa que não esteja nesta lista, a menos que explicitamente solicitado.

- **Framework:** React 18+ (Vite como bundler preferencial).
- **Linguagem:** TypeScript (Strict Mode: ON).
- **Estilização:** Tailwind CSS (Utilitários puros).
- **Componentes Base:** Shadcn/ui (Radix UI) - manter a consistência de acessibilidade.
- **Gerenciamento de Estado:** Zustand (para estados globais leves) ou Context API (para estados locais de módulo).
- **Data Fetching:** TanStack Query (React Query) para cache e sincronização de dados.
- **Formulários:** React Hook Form + Zod (Validação de schemas).
- **Roteamento:** React Router Dom v6+.
- **Animações:** Framer Motion (apenas para transições suaves de estado).

## 🎨 PADRÃO VISUAL "ANDRÉ-DESIGN" (HARDCODED)
- **Tema:** Dark Mode Nativo (obrigatório).
- **Background:** `bg-slate-950` (fundo principal) e `bg-slate-900/50` (cards).
- **Bordas:** `rounded-2xl` para cards e `rounded-xl` para botões/inputs.
- **Cores de Destaque:** - Primário: `blue-600`
  - Hover: `blue-700`
  - Texto Principal: `text-slate-100`
  - Texto Secundário: `text-slate-400`
- **Layout:** Estrutura "Bento Box" (Cards modulares, grid responsivo, padding consistente `p-4` ou `p-6`).
- Para uso de gráficos dê preferência as bibliotecas Recharts ou Lucide-react para ícones)


## ⚙️ REGRAS DE IMPLEMENTAÇÃO (ANTI-DELÍRIO)
1. **Tipagem:** Interfaces TypeScript para TUDO. Proibido uso de `any`.
2. **Modularização:** Um componente por arquivo. Lógica complexa deve ser extraída para `hooks` customizados.
3. **Performance:** Use `useMemo` para cálculos pesados e `React.memo` em componentes de lista que recebem muitos updates (ex: Censo ou Fluxo de Caixa).
4. **Clean Code:** - Remova logs de debug antes de entregar.
   - Use nomes de variáveis semânticos em PT-BR (ou conforme o padrão do projeto).
   - Nada de comentários óbvios. O código deve ser autoexplicativo.

## 🛑 PROTOCOLO DE ERRO
Se houver conflito entre uma biblioteca solicitada e esta stack, PARE e questione: "Mestre, esta biblioteca foge do nosso padrão Stack. Deseja seguir mesmo assim?".
