# Prompt 1/8 — Shell: Login + Layout + Sidebar

Crie a estrutura base de uma aplicacao SaaS chamada **Intelli Sense**. Esta e uma plataforma de inteligencia do ciclo de vida do cliente com dois modulos internos: Retain Sense (retencao, cor azul) e Obtain Sense (aquisicao, cor verde). Neste prompt, crie APENAS o login, o layout base com sidebar e o header. As paginas internas serao criadas nos proximos prompts.

## Design System (usar em TODAS as paginas)

- **Fonte:** Inter (Google Fonts). Titulos: SemiBold/Bold. Corpo: Regular. Dados: Medium com tabular-nums.
- **Cores principais:** Azul escuro #293b83, Verde marca #64b783, Teal #67b4b0, Verde esmeralda Obtain #10B981
- **Cores de suporte:** Preto #000000, Cinza #b4b4b4, Branco #ffffff, Fundo pagina #f8fafc
- **Cores de status:** Sucesso #64b783, Risco #ef4444, Atencao #f59e0b, Alto #f97316
- **Gradiente marca:** #293b83 para #67b4b0 (usar em botao de login e detalhes premium)
- **Cards:** Fundo branco, shadow-sm, rounded-xl, padding 24px
- **Espacamento:** gap-6 entre secoes, gap-4 entre cards de KPI
- **Modo:** Light mode APENAS. Sem dark mode.
- **Componentes:** Usar shadcn/ui (Card, Button, Badge, Input, Select, Separator, DropdownMenu, Tooltip, Sheet)
- **Icones:** Lucide React
- **Graficos:** Recharts
- **Idioma:** Portugues do Brasil (todos os textos)
- **Framework:** React 18 + TypeScript + Tailwind CSS

## Pagina: Login (/login)

Layout centralizado na tela. Fundo #f8fafc ou gradiente sutil muito leve.

**Card central (max-width 420px, centralizado vertical e horizontal):**

1. **Logo area** (topo do card):
   - Placeholder para logo (pode ser um icone Shield de Lucide em tamanho grande com gradiente azul-teal, ou um SVG placeholder)
   - Texto: "Intelli Sense" em 28px Inter Bold. "Intelli" em #293b83, "Sense" em #67b4b0
   - Subtexto: "Customer Lifecycle Intelligence" em #b4b4b4, 13px

2. **Formulario:**
   - Label "Email" + Input com icone Mail a esquerda, placeholder "seu@email.com"
   - Label "Senha" + Input com icone Lock a esquerda + botao Eye/EyeOff a direita para toggle visibilidade
   - Checkbox pequeno: "Manter conectado"
   - Botao "Entrar" — full width, height 48px, fundo gradiente #293b83 para #67b4b0, texto branco, rounded-lg, fonte 16px SemiBold
   - Link centralizado abaixo: "Esqueceu a senha?" em #67b4b0, 13px

3. **Separador:**
   - Linha horizontal com texto "ou" no meio (usar Separator do shadcn com texto)

4. **Botao secundario:**
   - "Criar conta" — full width, height 44px, variante outline, borda #293b83, texto #293b83

5. **Rodape do card:**
   - "Powered by Brintell" em #b4b4b4, 12px, centralizado

## Componente: Sidebar

A sidebar e fixa a esquerda, fundo escuro #1e293b, largura 260px expandida ou 72px colapsada.

**Estrutura da sidebar (de cima para baixo):**

1. **Header da sidebar:**
   - Logo: icone Shield (24px) com gradiente + texto "Intelli Sense" em branco 16px Bold
   - Abaixo: nome do tenant "DCCO Distribuicao" em #94a3b8 (cinza claro), 12px
   - Separador fino

2. **Menu principal:**

   **Item avulso (sem grupo):**
   - [icone LayoutDashboard] "Ciclo de Vida" — rota /

   **Grupo "RETAIN SENSE":**
   - Label de grupo: "RETAIN SENSE" em 10px caps, cor #293b83, com um pequeno circulo azul antes
   - [icone Shield] "Dashboard Executivo" — /retain
   - [icone BrainCircuit] "Predicoes de Churn" — /retain/predictions
   - [icone SearchCode] "Causas Raiz" — /retain/root-causes
   - [icone Calculator] "Simulador ROI" — /retain/roi
   - [icone Users] "Clientes" — /retain/customers
   - [icone Upload] "Upload de Dados" — /retain/upload

   **Grupo "OBTAIN SENSE":**
   - Label de grupo: "OBTAIN SENSE" em 10px caps, cor #10B981, com um pequeno circulo verde antes
   - [icone TrendingUp] "Dashboard Executivo" — /obtain
   - [icone Target] "Lead Scoring" — /obtain/leads
   - [icone Fingerprint] "ICP & Lookalike" — /obtain/icp
   - [icone GitBranch] "Funil & Gargalos" — /obtain/funnel
   - [icone DollarSign] "CAC vs LTV" — /obtain/cac-ltv
   - [icone Calculator] "Simulador ROI" — /obtain/roi
   - [icone Upload] "Upload de Dados" — /obtain/upload

   **Separador**

   - [icone Settings] "Configuracoes" — /settings

3. **Footer da sidebar:**
   - Separador
   - Avatar circular pequeno (iniciais "CF") + "Caio Ferreira" em branco 13px + botao LogOut pequeno

**Comportamento dos itens:**
- Item normal: texto #94a3b8 (cinza claro), hover: fundo #293548, texto branco
- Item ativo: fundo #293548, texto branco, borda esquerda 3px na cor do modulo (azul para Retain, verde para Obtain)
- Icones: 20px, mesma cor do texto

**Sidebar colapsavel:**
- Botao de toggle (ChevronLeft/ChevronRight) no topo ou bottom
- Quando colapsada (72px): mostra so icones, sem texto, sem labels de grupo
- Tooltip com nome do item ao passar o mouse nos icones

## Componente: Header

Barra horizontal no topo da area de conteudo (a direita da sidebar). Altura 64px, fundo branco, borda inferior sutil.

- **Esquerda:** Breadcrumb — "Intelli Sense > Retain Sense > Dashboard Executivo" (textos cinza, ultimo item preto)
- **Direita:** Icone Bell (notificacoes, com badge vermelho "3") + Avatar dropdown (Caio Ferreira, com opcoes Perfil e Sair)

## Componente: Layout base

```
+--sidebar--+---------------------------header----------------------------+
|            |  Breadcrumb                               [Bell] [Avatar]  |
|  Logo      |-----------------------------------------------------------|
|  Menu      |                                                            |
|  Items     |                    [CONTEUDO DA PAGINA]                     |
|            |                                                            |
|            |                    padding: 24px                           |
|            |                    max-width: 1400px                       |
|            |                    background: #f8fafc                     |
|  Footer    |                                                            |
+------------+------------------------------------------------------------+
```

O conteudo da pagina deve ter scroll independente. A sidebar e o header sao fixos.

## O que NAO criar neste prompt
- Nao crie as paginas internas (dashboards, tabelas, graficos). Apenas o layout com sidebar, header e uma area de conteudo vazia mostrando a rota atual.
- Crie uma pagina placeholder para cada rota listada na sidebar, com apenas o titulo da pagina e um texto "Em construcao".
