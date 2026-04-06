# Prompt 2/8 — Pagina: Visao do Ciclo de Vida (/)

Crie a pagina inicial da aplicacao Intelli Sense. Esta pagina e o overview que conecta visualmente os dois modulos: Obtain Sense (aquisicao, verde #10B981) e Retain Sense (retencao, azul #293b83). Ela mostra o ciclo completo: aquisicao -> conversao -> retencao.

## Design System resumido
- Fonte: Inter. Cores: azul #293b83, verde #10B981, teal #67b4b0, fundo #f8fafc, cards brancos shadow-sm rounded-xl. Graficos: Recharts. Componentes: shadcn/ui. Icones: Lucide. Idioma: PT-BR.

## Layout da pagina

**Header da pagina:**
- Titulo: "Ciclo de Vida do Cliente" (24px Bold)
- Subtitulo: "Visao unificada de aquisicao e retencao" (14px cinza)

**Secao 1: Tres blocos horizontais (grid 3 colunas com gap-6)**

### Bloco esquerdo — Obtain Sense
Card com borda superior grossa verde #10B981 (4px):
- Badge no topo: "Obtain Sense" (fundo #10B981, texto branco, rounded-full, 12px)
- Subtitulo: "Aquisicao" em cinza
- Grid 2x2 de mini-metricas:
  - "Leads no funil" — **287** (preto 22px Bold)
  - "Leads Hot" — **34** (verde 22px Bold)
  - "CAC medio" — **R$ 5.200** (preto 22px Bold)
  - "Taxa conversao" — **24%** (preto 22px Bold)
- Cada metrica tem label em cinza 12px acima do valor
- Link no rodape do card: "Ver dashboard completo →" (verde #10B981, 13px)

### Bloco central — Transicao
Card com fundo gradiente muito sutil (azul-verde quase transparente), sem borda:
- Icone grande centralizado: ArrowRight ou fluxo visual (setas de esquerda para direita)
- Numero centralizado grande: **12** (32px Bold preto)
- Label: "Novos clientes convertidos este mes" (14px cinza)
- Abaixo: "LTV medio previsto: **R$ 540k**" (16px, valor em bold)

### Bloco direito — Retain Sense
Card com borda superior grossa azul #293b83 (4px):
- Badge no topo: "Retain Sense" (fundo #293b83, texto branco, rounded-full, 12px)
- Subtitulo: "Retencao" em cinza
- Grid 2x2 de mini-metricas:
  - "Clientes ativos" — **482**
  - "Em risco" — **72** (vermelho #ef4444)
  - "Churn rate" — **3.8%**
  - "Receita em risco" — **R$ 847k** (vermelho)
- Link no rodape: "Ver dashboard completo →" (azul #293b83, 13px)

**Secao 2: Insight do Ecossistema (full width)**

Card com borda esquerda grossa (4px) com gradiente azul-para-verde. Fundo levemente colorido (#f0fdf4).
- Icone: Lightbulb ou Brain (amarelo dourado)
- Titulo: "Insight do Ecossistema" (16px Bold)
- Badge: "Retroalimentacao Retain → Obtain" (fundo cinza claro, texto cinza escuro, 11px)
- Texto: "Clientes adquiridos por **Indicacao** (Obtain) tem churn **62% menor** que a media (Retain). Recomendacao: aumentar investimento neste canal em 30%." (14px, palavras-chave em bold)

**Secao 3: Graficos cruzados (grid 2 colunas)**

### Grafico esquerda — Qualidade da aquisicao (Line Chart)
Card branco com titulo "Qualidade da Aquisicao ao Longo do Tempo":
- Recharts LineChart com 2 linhas:
  - Linha verde (#10B981): "LTV medio novos clientes" — eixo Y esquerdo (R$)
  - Linha azul (#293b83): "Churn rate novos clientes" — eixo Y direito (%)
- Eixo X: Out/25, Nov/25, Dez/25, Jan/26, Fev/26, Mar/26
- Dados mock LTV: 420k, 480k, 510k, 490k, 530k, 540k (tendencia subindo)
- Dados mock churn: 5.2%, 4.8%, 4.5%, 4.1%, 3.9%, 3.5% (tendencia caindo)
- Legenda abaixo do grafico
- Tooltip ao hover mostrando ambos valores

### Grafico direita — Origem dos melhores clientes (Horizontal Bar Chart)
Card branco com titulo "LTV Medio por Canal de Aquisicao":
- Recharts BarChart horizontal (layout="vertical") com barras:
  - Indicacao: R$ 890k (barra mais longa, cor verde #10B981)
  - Feira: R$ 720k (cor teal #67b4b0)
  - LinkedIn: R$ 540k (cor azul claro)
  - Google Ads: R$ 180k (cor amarelo #f59e0b)
  - Outbound: R$ 150k (cor cinza #94a3b8)
- Valor formatado ao final de cada barra
- Barras com rounded ends
