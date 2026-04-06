# Prompt 3/8 — Retain Sense: Dashboard Executivo (/retain)

Crie o dashboard executivo do modulo Retain Sense. Esta e a pagina principal de retencao, mostrando KPIs, graficos de tendencia de churn, distribuicao de risco e alertas. O contexto e uma empresa B2B de locacao de equipamentos industriais para mineracao, construcao e agro.

## Design System resumido
- Fonte: Inter. Cor de acento deste modulo: azul #293b83 e teal #67b4b0. Fundo #f8fafc, cards brancos shadow-sm rounded-xl. Recharts para graficos. shadcn/ui. Lucide icons. PT-BR.

## Header da pagina
- Titulo: "Dashboard Executivo" (24px Bold)
- Badge ao lado: "Retain Sense" (fundo #293b83, texto branco, rounded-full)
- Subtitulo: "Visao geral de retencao e risco da base de empresas" (14px cinza)

## Secao 1: KPIs (grid 4 colunas, gap-4)

Criar um componente MetricCard para cada KPI. Cada card tem:
- Canto superior esquerdo: icone dentro de circulo com fundo colorido suave (ex: fundo azul claro para icone azul)
- Label em cinza 13px
- Valor grande 28px Inter Bold preto
- Linha inferior: seta (ChevronUp ou ChevronDown) + porcentagem + texto "vs. mes anterior" em 12px

| # | Icone | Cor icone | Label | Valor | Seta | % | Cor |
|---|-------|-----------|-------|-------|------|---|-----|
| 1 | Users | azul | Empresas Ativas | 482 | ↑ | +2.3% | verde |
| 2 | TrendingDown | teal | Taxa de Churn | 3.8% | ↓ | -0.5% | verde (churn caiu = bom) |
| 3 | DollarSign | verde | Valor dos Contratos (MRR) | R$ 21.7M | ↑ | +1.2% | verde |
| 4 | AlertTriangle | vermelho | Receita em Risco | R$ 847K | ↑ | +12.4% | vermelho (risco subiu = ruim) |

## Secao 2: Graficos principais (grid 2 colunas, gap-6)

### Grafico esquerda — Tendencia de Churn (Area Chart)
Card branco com titulo "Tendencia de Churn — Ultimos 12 Meses" (16px SemiBold):
- Recharts AreaChart
- Eixo X: Abr/25, Mai/25, Jun/25, Jul/25, Ago/25, Set/25, Out/25, Nov/25, Dez/25, Jan/26, Fev/26, Mar/26
- Eixo Y: porcentagem (2% a 6%)
- Area preenchida com gradiente: topo #293b83 opacity 0.3, base transparente
- Linha da area: #293b83 solido, 2px
- Dados: [4.5, 4.8, 5.1, 4.9, 4.6, 4.3, 4.5, 4.2, 4.0, 3.8, 3.6, 3.8]
- Tooltip: card com "Mar/26: 3.8%"
- Grid horizontal tracejado sutil

### Grafico direita — Distribuicao de Risco (Donut/Pie Chart)
Card branco com titulo "Distribuicao de Risco" (16px SemiBold):
- Recharts PieChart com innerRadius (donut)
- 4 segmentos com cores:
  - Baixo: #64b783 — 312 empresas
  - Medio: #f59e0b — 98 empresas
  - Alto: #f97316 — 52 empresas
  - Critico: #ef4444 — 20 empresas
- Centro do donut: "482" em 32px Bold + "Total" em 12px cinza abaixo
- Legenda horizontal abaixo: circulo de cor + nome + quantidade

## Secao 3: Graficos secundarios (grid 2 colunas)

### Grafico esquerda — Receita por Segmento (Horizontal Bar Chart)
Card com titulo "Receita por Segmento":
- Recharts BarChart com layout="vertical"
- 4 barras horizontais:
  - Mineracao: R$ 8.2M (cor #293b83)
  - Construcao Civil: R$ 7.1M (cor #3b5998)
  - Agropecuaria: R$ 4.3M (cor #67b4b0)
  - Industrial: R$ 2.1M (cor #64b783)
- Valores formatados ao final de cada barra
- Barras com rounded ends (radius 4)

### Grafico direita — Health Score Medio (Gauge)
Card com titulo "Health Score Medio":
- Implementar como um semicirculo gauge usando Recharts PieChart customizado ou SVG:
  - Arco de fundo cinza claro
  - Arco preenchido ate 72% com cor #64b783 (verde)
  - Numero grande centralizado: "72" (48px Bold) + "/100" (16px cinza)
  - Texto abaixo: "Saude media da base de empresas" (13px cinza)
- Zonas visuais sugeridas no arco: 0-40 vermelho, 40-60 amarelo, 60-80 verde claro, 80-100 verde escuro

## Secao 4: Alertas Recentes

Card branco com:
- Titulo: "Alertas Recentes" (16px SemiBold) + Badge: "5" (fundo vermelho, texto branco, rounded-full)
- Lista de 5 items, cada um como uma linha com:
  - Circulo pequeno de cor (8px): vermelho para critico, amarelo para atencao
  - Nome da empresa em bold 14px
  - Texto da mensagem em regular 14px cinza escuro
  - Tempo relativo a direita em cinza 12px
  - Separador fino entre items

Dados:
1. [vermelho] **Mineradora Vale Norte Ltda** — Churn probability subiu para 89% — ha 2h
2. [vermelho] **Construtora Horizonte SA** — Contrato vence em 7 dias, sem renovacao — ha 5h
3. [amarelo] **AgroPlan Mecanizacao** — 3 chamados tecnicos abertos esta semana — ha 1d
4. [vermelho] **Terraplenagem Tocantins** — Health score caiu de 45 para 22 — ha 1d
5. [amarelo] **Pedreira Goias Central** — NPS caiu para 4 (detrator) — ha 2d
