# PRD — Intelli Sense: Customer Lifecycle Intelligence Platform

## 1. VISAO GERAL

### 1.1 O que e o Intelli Sense

O Intelli Sense e uma plataforma SaaS de inteligencia do ciclo de vida do cliente. Ele conecta dois modulos:

- **Retain Sense** (retencao): preve quais clientes vao sair, explica os motivos com IA (SHAP values) e orienta acoes de retencao priorizadas por receita em risco.
- **Obtain Sense** (aquisicao): mapeia o Perfil de Cliente Ideal (ICP) com base nos melhores clientes, faz lead scoring preditivo, analisa funil de vendas e otimiza CAC vs LTV.

O diferencial estrategico e o **loop de retroalimentacao**: padroes de churn do Retain alimentam automaticamente o ICP do Obtain. O marketing para de investir em perfis que historicamente cancelam rapido.

### 1.2 Arquitetura da interface

A aplicacao e uma **Single Page Application** com tres camadas visuais:

1. **Shell (Intelli Sense)**: login, sidebar, header, pagina de visao do ciclo de vida, configuracoes. E o container que abriga os modulos.
2. **Modulo Retain Sense**: 6 paginas proprias, acessiveis por rotas `/retain/*`, com cor de acento azul.
3. **Modulo Obtain Sense**: 7 paginas proprias, acessiveis por rotas `/obtain/*`, com cor de acento verde esmeralda.

Cada modulo tem suas proprias paginas e componentes, mas compartilham o layout (sidebar + header), componentes base (MetricCard, DataTable, ShapWaterfall) e o sistema de design.

### 1.3 Contexto de demonstracao

A aplicacao sera demonstrada para a **DCCO** (dcco.com.br), uma empresa B2B de distribuicao e locacao de equipamentos industriais (geradores, compressores, escavadeiras) para clientes dos setores de mineracao, construcao civil, agropecuaria e industrial, com operacoes em Goias, Distrito Federal e Tocantins.

Todos os dados mock devem refletir esse contexto B2B industrial. Os "clientes" da DCCO sao empresas (nao pessoas fisicas). Tickets mensais variam de R$8.000 a R$200.000.

### 1.4 Multi-setor

A plataforma e generica — funciona para qualquer setor. Todos os labels de interface sao dinamicos, vindos de um objeto de configuracao `sectorConfig` que o admin define ao criar o tenant. **Nenhum texto deve ser hardcoded como "assinante", "mensalidade" ou qualquer termo de um setor especifico.** Os labels devem ser lidos do sectorConfig.

Exemplo de sectorConfig para a DCCO:
```json
{
  "customerLabel": "Empresa",
  "customersLabel": "Empresas",
  "revenueLabel": "Valor do Contrato",
  "engagementLabel": "Utilizacao de Equipamentos",
  "ticketLabel": "Chamados Tecnicos",
  "tenureLabel": "Tempo de Parceria",
  "segments": ["Mineracao", "Construcao Civil", "Agropecuaria", "Industrial"],
  "currency": "BRL"
}
```

---

## 2. IDENTIDADE VISUAL (OBRIGATORIO)

### 2.1 Cores

| Cor | Hex | Uso |
|-----|-----|-----|
| Azul escuro (primaria marca) | #293b83 | Headers, sidebar, botoes primarios Retain |
| Verde marca | #64b783 | Indicadores positivos, badges sucesso |
| Teal/Verde-azulado | #67b4b0 | Acentos, links, hover states |
| Preto | #000000 | Textos principais |
| Cinza | #b4b4b4 | Textos secundarios, bordas, placeholders |
| Branco | #ffffff | Backgrounds, cards |
| **Obtain verde esmeralda** | #10B981 | Cor de acento de todo o modulo Obtain Sense |
| Obtain verde claro | #34D399 | Acentos secundarios do Obtain |
| Vermelho risco | #ef4444 | Churn, risco critico, metricas negativas |
| Amarelo atencao | #f59e0b | Risco medio, alertas |
| Laranja alto | #f97316 | Risco alto |

**Gradiente da marca:** #293b83 para #67b4b0 — usar em elementos de destaque (hero, sidebar header, barras premium).

**Regra de cor por modulo:**
- Paginas do Retain Sense: elementos de destaque usam azul #293b83
- Paginas do Obtain Sense: elementos de destaque usam verde #10B981
- Shell (login, lifecycle, settings): gradiente azul-teal da marca

### 2.2 Tipografia

- **Fonte unica:** Inter (Google Fonts)
- Titulos: Inter SemiBold ou Bold
- Corpo: Inter Regular
- Dados e numeros: Inter Medium (tabular-nums)
- Tamanhos sugeridos: h1 28px, h2 22px, h3 18px, body 14px, caption 12px

### 2.3 Tom visual

- Light mode APENAS (fundo principal #f8fafc, cards brancos)
- Cards com sombra sutil (shadow-sm), bordas arredondadas (rounded-lg ou rounded-xl)
- Espacamento generoso entre secoes (gap-6 minimo)
- Data-driven: numeros grandes e legíveis, graficos limpos
- Profissional e corporativo, mas nao frio — tons de cor nos graficos trazem vida

### 2.4 Logo

- Escudo com olho e circuitos integrados, gradiente azul-para-teal
- Texto: "Retain Sense" onde "Retain" e azul #293b83 e "Sense" e teal #67b4b0
- O Obtain Sense segue o mesmo pattern visual do logo mas com verde esmeralda
- Subtitulo: "Predictive Retention Powered by Brintell." em cinza
- Na sidebar: versao horizontal menor. Na tela de login: versao vertical grande.

---

## 3. ESTRUTURA DE NAVEGACAO

### 3.1 Sidebar (fixa a esquerda, colapsavel)

A sidebar e o elemento central de navegacao. Fundo escuro (#1e293b ou similar), texto claro.

```
[Logo Intelli Sense] — versao horizontal, compacta
[Nome do tenant: "DCCO Distribuicao"]
──────────────────────

[icone Brain] Ciclo de Vida                    /

── RETAIN SENSE (badge azul) ──
[icone Shield]      Dashboard Executivo         /retain
[icone BrainCircuit] Predicoes de Churn         /retain/predictions
[icone SearchCode]  Causas Raiz                 /retain/root-causes
[icone Calculator]  Simulador ROI               /retain/roi
[icone Users]       Clientes                    /retain/customers
[icone Upload]      Upload de Dados             /retain/upload

── OBTAIN SENSE (badge verde) ──
[icone TrendingUp]  Dashboard Executivo         /obtain
[icone Target]      Lead Scoring                /obtain/leads
[icone Fingerprint] ICP & Lookalike             /obtain/icp
[icone GitBranch]   Funil & Gargalos            /obtain/funnel
[icone DollarSign]  CAC vs LTV                  /obtain/cac-ltv
[icone Calculator]  Simulador ROI               /obtain/roi
[icone Upload]      Upload de Dados             /obtain/upload

──────────────────────
[icone Settings] Configuracoes                  /settings

──────────────────────
[Avatar] Caio Ferreira  [Logout]
```

**Comportamento:**
- A sidebar quando colapsada mostra apenas os icones
- Item ativo tem background mais claro e borda esquerda colorida (azul para Retain, verde para Obtain)
- Os separadores "RETAIN SENSE" e "OBTAIN SENSE" sao labels em caps pequeno com a cor do modulo
- O logo e o nome do tenant ficam no topo

### 3.2 Header (topo, dentro da area de conteudo)

- Esquerda: Breadcrumb (ex: "Retain Sense > Predicoes de Churn")
- Direita: icone de notificacoes (sino) + avatar do usuario com dropdown (perfil, logout)
- Abaixo do breadcrumb em algumas paginas: titulo da pagina + descricao curta

---

## 4. PAGINAS — SHELL (Intelli Sense)

### 4.1 Tela de Login (/login)

Layout centralizado, fundo branco ou gradiente sutil.

**Card central (max-width 420px):**
- Logo Intelli Sense (versao vertical, grande, centralizada)
- Espaco
- Titulo: "Acesse sua conta" (Inter SemiBold, 22px)
- Subtitulo: "Plataforma de Inteligencia do Ciclo de Vida do Cliente" (cinza, 14px)
- Campo: Email (input com icone envelope a esquerda, placeholder "seu@email.com")
- Campo: Senha (input com icone cadeado a esquerda + toggle de visibilidade a direita)
- Checkbox: "Manter conectado"
- Botao: "Entrar" (full width, fundo gradiente #293b83 para #67b4b0, texto branco, rounded-lg, height 48px)
- Link centralizado: "Esqueceu a senha?" (teal, 13px)
- Separador horizontal com texto "ou" no meio
- Botao outline: "Criar conta" (full width, borda #293b83, texto #293b83, height 44px)
- Rodape: "Powered by Brintell" (cinza #b4b4b4, 12px)

**Tela de Registro (pode ser modal ou pagina separada):**
- Campos: Nome completo, Email, Senha, Confirmar senha
- Select: Setor da empresa (Industrial B2B, Telecom, Fintech, SaaS, Saude, Educacao, Varejo, Outro)
- Campo: Nome da empresa
- Botao: "Criar conta"
- Link: "Ja tem conta? Entrar"

---

### 4.2 Visao do Ciclo de Vida (/) — Pagina principal do ecossistema

**Objetivo:** Esta e a pagina que conecta Retain e Obtain visualmente. Mostra o ciclo completo do cliente: aquisicao -> conversao -> retencao. E a primeira coisa que o usuario ve apos o login.

**Layout: 3 blocos horizontais representando o ciclo**

#### Bloco esquerdo — Obtain Sense (borda e acentos verdes #10B981)
Card com:
- Badge: "Obtain Sense" (verde)
- Titulo: "Aquisicao"
- 4 mini-metricas em grid 2x2:
  - Leads ativos no funil: **287**
  - Leads Hot: **34** (badge vermelho/laranja)
  - CAC medio: **R$ 5.200**
  - Taxa conversao: **24%**
- Botao link: "Ver dashboard completo ->"

#### Bloco central — Transicao (gradiente azul para verde)
Visual de fluxo/seta conectando Obtain ao Retain:
- Numero grande centralizado: **12** novos clientes este mes
- Subtexto: "LTV medio previsto: R$ 540k"
- Icone de seta ou fluxo visual de esquerda para direita

#### Bloco direito — Retain Sense (borda e acentos azuis #293b83)
Card com:
- Badge: "Retain Sense" (azul)
- Titulo: "Retencao"
- 4 mini-metricas em grid 2x2:
  - Clientes ativos: **482**
  - Em risco: **72** (badge vermelho)
  - Churn rate: **3.8%**
  - Receita em risco: **R$ 847k**
- Botao link: "Ver dashboard completo ->"

#### Secao abaixo: Insight do Ecossistema
Card com destaque (borda esquerda gradiente azul-verde, fundo levemente colorido):
- Icone de lampada ou cerebro
- Titulo: "Insight do Ecossistema"
- Texto: "Clientes adquiridos por Indicacao (Obtain) tem churn 62% menor que a media (Retain). Recomendacao: aumentar investimento neste canal em 30%."
- Badge: "Retroalimentacao Retain -> Obtain"

#### Secao abaixo: Metricas cruzadas (grid 2 colunas)

**Grafico esquerda — Qualidade da aquisicao ao longo do tempo (line chart)**
- Eixo X: ultimos 6 meses
- 2 linhas: "LTV medio dos novos clientes" (verde) e "Churn rate dos novos clientes" (azul)
- Mostra se a qualidade da aquisicao esta melhorando

**Grafico direita — Origem dos melhores clientes (horizontal bar chart)**
- Barras: Indicacao (maior LTV), Feira, LinkedIn, Google Ads, Outbound
- Cada barra tem cor de gradiente e o valor de LTV medio

---

## 5. PAGINAS — RETAIN SENSE

### 5.1 Dashboard Executivo (/retain)

**Header da pagina:**
- Titulo: "Dashboard Executivo" com badge "Retain Sense" azul ao lado
- Subtitulo: "Visao geral de retencao e risco da base de clientes"

**Secao 1: KPIs (4 cards em grid horizontal, gap-4)**
Cada card (MetricCard) tem:
- Icone no canto superior esquerdo (dentro de circulo colorido suave)
- Label em cinza (13px)
- Valor grande (28px, Inter Bold, preto)
- Linha inferior: seta + percentual de variacao vs. mes anterior
  - Verde com seta para cima = positivo
  - Vermelho com seta para baixo = negativo
  - Excecao: churn rate caindo e verde (bom)

| Card | Icone | Label (usa sectorConfig) | Valor mock | Variacao |
|------|-------|-------------------------|-----------|----------|
| 1 | Users | "{customersLabel} Ativos" | 482 | +2.3% (verde) |
| 2 | TrendingDown | "Taxa de Churn" | 3.8% | -0.5% (verde — churn caiu) |
| 3 | DollarSign | "{revenueLabel} (MRR)" | R$ 21.7M | +1.2% (verde) |
| 4 | AlertTriangle | "Receita em Risco" | R$ 847K | +12.4% (vermelho — risco subiu) |

**Secao 2: Graficos principais (grid 2 colunas, gap-6)**

**Grafico esquerda — Tendencia de Churn (area chart)**
- Card branco com titulo "Tendencia de Churn — Ultimos 12 Meses"
- Eixo X: Abr/25, Mai/25, Jun/25... Mar/26
- Eixo Y: taxa de churn (%)
- Area preenchida com gradiente #293b83 para transparente
- Linha da area em #293b83 solido
- Tooltip: ao passar o mouse mostra "Jun/25: 4.2%"
- Dados mock: oscilar entre 3.2% e 5.1%, com tendencia de queda nos ultimos 3 meses (3.8%, 3.6%, 3.8%)

**Grafico direita — Distribuicao de Risco (donut chart)**
- Card branco com titulo "Distribuicao de Risco"
- Donut com 4 segmentos:
  - Baixo: #64b783 (verde) — 312 clientes
  - Medio: #f59e0b (amarelo) — 98 clientes
  - Alto: #f97316 (laranja) — 52 clientes
  - Critico: #ef4444 (vermelho) — 20 clientes
- Numero central grande: "482" com texto "Total" abaixo
- Legenda abaixo do donut com cor + nome + quantidade

**Secao 3: Graficos secundarios (grid 2 colunas)**

**Grafico esquerda — Receita por Segmento (bar chart horizontal)**
- Card com titulo "Receita por Segmento"
- Barras horizontais, uma por segmento (do sectorConfig.segments):
  - Mineracao: R$ 8.2M (barra mais longa)
  - Construcao Civil: R$ 7.1M
  - Agropecuaria: R$ 4.3M
  - Industrial: R$ 2.1M
- Barras com gradiente azul-teal
- Valores formatados ao final da barra

**Grafico direita — Health Score Medio (gauge/speedometer)**
- Card com titulo "Health Score Medio"
- Gauge semicircular ou circular com ponteiro
- Valor: 72 (de 100)
- Zonas de cor: 0-40 vermelho, 40-60 amarelo, 60-80 verde claro (#64b783), 80-100 verde escuro
- Texto abaixo: "Saude media da base de {customersLabel}"

**Secao 4: Alertas recentes**
- Card com titulo "Alertas Recentes" e badge de contagem
- Lista de 5 items, cada um com:
  - Icone de severidade (circulo vermelho ou amarelo)
  - Nome do cliente (bold)
  - Mensagem (regular)
  - Tempo relativo a direita ("ha 2h", "ha 5h")

Dados mock:
1. [vermelho] **Mineradora Vale Norte Ltda** — Churn probability subiu para 89% — ha 2h
2. [vermelho] **Construtora Horizonte SA** — Contrato vence em 7 dias, sem renovacao — ha 5h
3. [amarelo] **AgroPlan Mecanizacao** — 3 chamados tecnicos abertos esta semana — ha 1d
4. [vermelho] **Terraplenagem Tocantins** — Health score caiu de 45 para 22 — ha 1d
5. [amarelo] **Pedreira Goias Central** — NPS caiu para 4 (detrator) — ha 2d

---

### 5.2 Predicoes de Churn (/retain/predictions)

**Header:** "Predicoes de Churn" + badge Retain Sense + descricao "Clientes ordenados por probabilidade de cancelamento"

**Secao: Barra de filtros (horizontal, dentro de card)**
- Input de busca com lupa: "Buscar por nome ou codigo..."
- Select: Nivel de Risco (Todos, Baixo, Medio, Alto, Critico)
- Select: Segmento (opcoes do sectorConfig.segments)
- Select: Status (Ativo, Em Risco, Churned)
- Botao outline direita: "Exportar CSV" com icone Download

**Secao: Tabela de clientes**

| Coluna | Formato | Largura aprox |
|--------|---------|---------------|
| {customerLabel} | Nome em bold + codigo pequeno abaixo em cinza | 25% |
| Segmento | Badge colorido (cada segmento uma cor distinta) | 12% |
| {revenueLabel} | R$ formatado com pontos de milhar | 12% |
| Health Score | Barra de progresso colorida (vermelho<40, amarelo 40-60, verde>60) + numero | 15% |
| Prob. Churn | Porcentagem com cor (vermelho>75%, laranja>50%, amarelo>25%, verde<25%) | 10% |
| Risco | Badge: Baixo (bg verde claro, texto verde), Medio (bg amarelo claro), Alto (bg laranja claro), Critico (bg vermelho claro, texto vermelho) | 10% |
| Tendencia | Seta para cima vermelha (risco aumentou) ou para baixo verde (diminuiu) | 6% |
| | Botao "Ver detalhes" (outline, pequeno) | 10% |

- Paginacao: 20 itens por pagina com controles "Anterior / Proximo" e indicador "Pagina 1 de 25"
- Ordenacao: clicar no header da coluna ordena. Default: Prob. Churn descendente
- Linhas de risco Critico: fundo levemente rosado (#fef2f2)
- Linhas de risco Alto: fundo levemente laranja (#fff7ed)

**20 clientes mock (usar na tabela):**
```
Mineradora Vale Norte Ltda | Mineracao | R$ 156.800 | Health 18 | Churn 89% | Critico | ↑
Terraplenagem Tocantins | Construcao Civil | R$ 45.200 | Health 22 | Churn 85% | Critico | ↑
Irrigacao Cerrado LTDA | Agropecuaria | R$ 43.200 | Health 15 | Churn 91% | Critico | ↑
Construtora Horizonte SA | Construcao Civil | R$ 89.400 | Health 32 | Churn 78% | Alto | ↑
AgroPlan Mecanizacao | Agropecuaria | R$ 67.200 | Health 38 | Churn 72% | Alto | ↓
Silos Araguaia LTDA | Agropecuaria | R$ 34.600 | Health 29 | Churn 76% | Alto | ↑
LogPetro Transportes | Industrial | R$ 56.700 | Health 35 | Churn 68% | Alto | ↑
Pavimentacao Nacional SA | Construcao Civil | R$ 78.400 | Health 52 | Churn 54% | Medio | ↓
Pedreira Goias Central | Mineracao | R$ 134.500 | Health 55 | Churn 48% | Medio | ↓
Mineracao Rio Claro | Mineracao | R$ 178.900 | Health 64 | Churn 42% | Medio | ↑
Industrial Minas Gerais | Industrial | R$ 198.400 | Health 61 | Churn 44% | Medio | ↓
Construtora Alianca GO | Construcao Civil | R$ 95.600 | Health 73 | Churn 28% | Baixo | ↓
Concreteira Planalto | Construcao Civil | R$ 112.300 | Health 76 | Churn 22% | Baixo | ↓
Usina Solar Goias | Industrial | R$ 89.100 | Health 79 | Churn 18% | Baixo | ↓
Fazenda Sao Jorge Energia | Agropecuaria | R$ 78.900 | Health 82 | Churn 15% | Baixo | ↓
Construtora Capital DF | Construcao Civil | R$ 167.800 | Health 85 | Churn 12% | Baixo | ↓
BrasilAgro Maquinas | Agropecuaria | R$ 145.600 | Health 88 | Churn 10% | Baixo | ↓
Cimento Norte Tocantins | Industrial | R$ 201.300 | Health 91 | Churn 7% | Baixo | ↓
Siderurgica Centro-Oeste | Industrial | R$ 312.400 | Health 94 | Churn 4% | Baixo | ↓
Mineracao Serra Dourada | Mineracao | R$ 223.100 | Health 58 | Churn 46% | Medio | ↑
```

**Drawer lateral (abre ao clicar em "Ver detalhes")**

Painel que desliza da direita (width ~500px), com overlay escuro no fundo. Fechavel com X no canto ou clicando fora.

**Cabecalho do drawer:**
- Nome da empresa (24px, bold)
- Badge de risco (Critico vermelho)
- Codigo do cliente em cinza
- Segmento badge

**Secao 1: Score Cards (3 mini-cards em linha)**
- Health Score: 18/100 (barra vermelha, fundo avermelhado)
- Prob. Churn: 89% (texto vermelho grande)
- {revenueLabel}: R$ 156.800/mes

**Secao 2: SHAP Waterfall Chart (COMPONENTE MAIS IMPORTANTE)**

Titulo: "Fatores que influenciam a predicao"

Este grafico e um waterfall horizontal. Ele mostra como cada fator contribui para a probabilidade final de churn, partindo de uma probabilidade base.

Estrutura visual:
```
Probabilidade base: 15%

Atraso no pagamento (22 dias)    ████████████████  +28%   (barra vermelha)
Contrato vence em 15 dias        █████████████     +22%   (barra vermelha)
Baixa utilizacao (35%)           ██████████        +18%   (barra vermelha)
Alto vol. chamados (8)           ████████          +15%   (barra vermelha)
Parceria longa (36 meses)        ████████          -11%   (barra verde)
Receita alta (R$ 156k)           ██████            -8%    (barra verde)
                                 ─────────────────────
Predicao final:                                    89%
```

Detalhamento do layout:
- Cada linha tem: nome do fator (texto), valor real entre parenteses, barra horizontal colorida, contribuicao percentual
- Barras VERMELHAS: fatores que AUMENTAM o risco (direction = positive = ruim)
- Barras VERDES: fatores que DIMINUEM o risco (direction = negative = bom, protetor)
- Barras alinhadas a partir do centro: vermelhas crescem para a direita, verdes crescem para a esquerda
- Na parte superior: "Probabilidade base: 15%" com linha tracejada
- Na parte inferior: "Predicao final: 89%" em bold com destaque
- Cada fator tem tooltip com mais detalhes ao passar o mouse

Mock data para o drawer da "Mineradora Vale Norte Ltda":
```json
[
  {"feature": "dim_payment_regularity", "label": "Atraso no pagamento (22 dias)", "value": 22, "impact": 0.28, "direction": "positive"},
  {"feature": "dim_contract_remaining_days", "label": "Contrato vence em 15 dias", "value": 15, "impact": 0.22, "direction": "positive"},
  {"feature": "dim_usage_intensity", "label": "Baixa utilizacao de equipamentos (35%)", "value": 35, "impact": 0.18, "direction": "positive"},
  {"feature": "dim_support_volume", "label": "Alto volume de chamados (8)", "value": 8, "impact": 0.15, "direction": "positive"},
  {"feature": "dim_tenure_days", "label": "Parceria longa (36 meses)", "value": 1080, "impact": -0.11, "direction": "negative"},
  {"feature": "dim_revenue", "label": "Receita alta (R$ 156.800)", "value": 156800, "impact": -0.08, "direction": "negative"}
]
```

**Secao 3: Acao Recomendada**
- Card com borda esquerda grossa azul #293b83, fundo levemente azulado
- Titulo: "Acao Recomendada" (bold)
- Texto: "Agendar reuniao de renovacao com desconto de 5-10% para contrato de 12 meses. Priorizar resolucao dos 8 chamados tecnicos pendentes antes da reuniao."
- Botao: "Criar acao de retencao" (botao primario azul)

**Secao 4: Informacoes do cliente**
- Grid 2 colunas com labels em cinza e valores em preto:
  - Cidade/UF: Goiania/GO
  - {tenureLabel}: 36 meses
  - {engagementLabel}: 35%
  - NPS: 3
  - {ticketLabel}: 8 abertos
  - Servicos contratados: 4
  - Ultimo contato: 15/03/2026
  - Contrato: Anual (vence 15/04/2026)

---

### 5.3 Causas Raiz (/retain/root-causes)

**Header:** "Analise de Causas Raiz" + badge Retain Sense

**Secao 1: Resumo (3 cards MetricCard)**
- {customersLabel} Churned (12 meses): **47**
- Principal causa: **"Vencimento sem renovacao"**
- Receita total perdida: **R$ 2.1M**

**Secao 2: Layout 2 colunas**

**Esquerda — Tabela de causas:**

| Causa | Categoria | Impacto | Afetados | Receita Risco |
|-------|-----------|---------|----------|---------------|
| Atraso recorrente no pagamento | Financeiro | 28% | 34 | R$ 412K |
| Vencimento de contrato sem renovacao | Contratual | 22% | 28 | R$ 367K |
| Baixa utilizacao de equipamentos | Engajamento | 18% | 22 | R$ 198K |
| Volume alto de chamados tecnicos | Suporte | 15% | 19 | R$ 156K |
| NPS detrator (< 6) | Satisfacao | 12% | 15 | R$ 134K |
| Reducao de servicos contratados | Uso | 5% | 6 | R$ 67K |

**Direita — Bar chart horizontal** espelhando a tabela. Barras coloridas por categoria (cada categoria uma cor).

**Secao 3: Tendencia mensal (line chart)**
- 4 linhas, uma por categoria principal (Financeiro, Contratual, Engajamento, Suporte)
- Eixo X: ultimos 6 meses
- Legenda colorida abaixo

---

### 5.4 Simulador ROI Retencao (/retain/roi)

**Header:** "Simulador de ROI" + badge Retain Sense + descricao "Calcule o impacto financeiro de reduzir o churn"

**Layout: 2 colunas**

**Coluna esquerda — Inputs (card branco)**
Titulo: "Configure sua simulacao"
- **Slider:** Total de {customersLabel} ativos (range 100-5000, default 482, step 10)
  - Mostrar valor atual ao lado do slider
- **Slider:** {revenueLabel} medio/mes em R$ (range 1.000-200.000, default 45.000, step 1.000)
  - Formatado como R$ 45.000
- **Slider:** Taxa de churn atual % (range 1.0-15.0, default 3.8, step 0.1)
- **Slider:** Melhoria esperada com Retain Sense % (range 10-50, default 25, step 5)
- Botao: "Calcular ROI" (primario azul, full width)

**Coluna direita — Resultados (3 cards empilhados)**

**Card 1: Cenario Conservador (15% de melhoria)**
- Fundo neutro, borda cinza
- {customersLabel} retidos/ano: **X**
- Receita preservada/mes: **R$ Y**
- Receita preservada/ano: **R$ Z**

**Card 2: Cenario Esperado (25% de melhoria)** — DESTAQUE
- Borda com gradiente azul-teal (grosso, 3px)
- Badge "Recomendado" no canto
- Mesmas metricas, valores maiores
- Texto bold

**Card 3: Cenario Otimista (40% de melhoria)**
- Fundo neutro, borda cinza
- Mesmas metricas, valores maiores

**Abaixo dos cards (full width):**
- Texto grande em destaque (20px, bold): "Com o Retain Sense, voce pode preservar ate **R$ X.XM por ano**"
- Subtexto cinza: "Baseado em benchmarks de retencao B2B do setor industrial"
- Botao CTA: "Solicitar demonstracao personalizada" (gradiente azul-teal, padding grande)

---

### 5.5 Clientes (/retain/customers)

**Filtros:** Busca, Segmento, Status, Nivel de Risco, Range de receita (min-max), botoes "Exportar CSV" e "Adicionar {customerLabel}"

**Tabela completa:**
| Nome + codigo | Segmento (badge) | Cidade/UF | {revenueLabel} | Tenure | Health Score (barra+num) | Risco (badge) | Status (badge) | Ultima Atividade |

- Paginacao, ordenacao por qualquer coluna
- Selecao multipla com checkbox, acao em lote: "Criar acao de retencao para selecionados"

---

### 5.6 Upload de Dados (/retain/upload)

**Passo 1: Upload**
- Area de drag-and-drop grande (bordas tracejadas cinza, icone CloudUpload centralizado grande)
- Texto: "Arraste seu arquivo CSV ou clique para selecionar"
- Texto menor cinza: "Formatos aceitos: .csv, .xlsx — Maximo 50MB"
- Abaixo: tabela de uploads anteriores (nome, data, linhas, status badge)

**Passo 2: Mapeamento de Colunas (aparece apos upload)**
Card com titulo "Mapeie suas colunas para as dimensoes do Retain Sense"

Layout de mapeamento:
| Dimensao Retain Sense | Sua Coluna (dropdown) | Status |
|---|---|---|
| Identificador do cliente | [dropdown com colunas do CSV] | ✓ Mapeado |
| Nome | [dropdown] | ✓ Mapeado |
| Receita | [dropdown] | ✓ Sugerido |
| Regularidade de pagamento | [dropdown] | — Nao mapeado |
| Tempo de relacionamento | [dropdown] | ✓ Sugerido |
| Frequencia de interacao | [dropdown] | — |
| Volume de suporte | [dropdown] | ✓ Sugerido |
| Satisfacao | [dropdown] | — |
| Vinculo contratual | [dropdown] | — |
| Intensidade de uso | [dropdown] | — |
| Recencia | [dropdown] | — |

- Colunas sugeridas automaticamente: fundo verde claro
- Indicador: "5 de 11 dimensoes mapeadas — Precisao estimada: Media"
- Barra de progresso mostrando quantas dimensoes foram mapeadas
- Colunas do CSV nao mapeadas aparecem em secao separada: "Campos extras (serao usados como features adicionais no modelo)"
- Botao: "Confirmar e processar" (primario)

**Passo 3: Processamento**
- Progress bar animada com porcentagem
- Textos sequenciais: "Processando 500 registros..." -> "Calculando health scores..." -> "Rodando modelo de predicao..." -> "Gerando explicacoes SHAP..."
- Quando concluir: card verde com check "Processamento completo! 500 {customersLabel} analisados."
- Botao: "Ver predicoes ->"

---

## 6. PAGINAS — OBTAIN SENSE

### 6.1 Dashboard Executivo (/obtain)

**Header:** "Dashboard Executivo" + badge "Obtain Sense" verde

**Secao 1: KPIs (5 cards, gap-4)**

| Card | Icone | Label | Valor | Variacao |
|------|-------|-------|-------|----------|
| 1 | DollarSign | CAC Atual | R$ 5.200 | -8% (verde, CAC caiu) |
| 2 | TrendingUp | LTV Medio Previsto | R$ 540K | +5% (verde) |
| 3 | Target | Taxa Conversao Funil | 24% | +2.1% (verde) |
| 4 | Clock | Tempo Medio Aquisicao | 43 dias | -3 dias (verde) |
| 5 | Wallet | Receita Potencial no Funil | R$ 38.2M | +15% (verde) |

**Secao 2: Graficos (grid 2 colunas)**

**Esquerda — Matriz CAC x LTV por Canal (scatter plot)**
- Card com titulo "Eficiencia de Canais: CAC x LTV"
- Scatter plot com 4 quadrantes:
  - Q1 (canto superior esquerdo — baixo CAC, alto LTV): fundo verde claro, label "Escalar"
  - Q2 (canto superior direito — alto CAC, alto LTV): fundo azul claro, label "Avaliar"
  - Q3 (canto inferior esquerdo — baixo CAC, baixo LTV): fundo amarelo claro, label "Atencao"
  - Q4 (canto inferior direito — alto CAC, baixo LTV): fundo vermelho claro, label "Interromper"
- Pontos (circulos) representando campanhas:
  - Indicacao: Q1 (CAC R$2.1k, LTV R$890k) — circulo grande verde
  - Feira AgroBrasilia: Q2 (CAC R$8.5k, LTV R$720k) — circulo azul
  - LinkedIn: Q2 (CAC R$5.2k, LTV R$540k) — circulo azul
  - Google Ads: Q3 (CAC R$3.8k, LTV R$180k) — circulo amarelo
  - Outbound: Q4 (CAC R$12k, LTV R$150k) — circulo vermelho
- Linhas tracejadas dividindo os quadrantes
- Tooltip ao passar mostra detalhes da campanha

**Direita — Funil de Conversao (funnel chart vertical ou horizontal)**
- Card com titulo "Funil de Vendas"
- 5 etapas com largura proporcional ao volume:
  - Prospeccao: 287 leads (100%, barra mais larga)
  - Qualificacao: 198 leads (69%)
  - Demo: 89 leads (31%)
  - Proposta: 45 leads (16%)
  - Fechado: 12 leads (4%)
- Cores: gradiente de verde claro (topo) a verde escuro (base)
- Drop-off rate entre cada etapa: "31% perdidos", "55% perdidos" etc.
- Destaque no gargalo (Demo -> Proposta): borda vermelha, icone de alerta

**Secao 3: Graficos secundarios (grid 2 colunas)**

**Esquerda — Evolucao qualidade do funil (stacked area chart)**
- Titulo: "Qualidade dos Leads por Mes"
- Eixo X: ultimos 6 meses
- 3 areas empilhadas: Hot (#10B981), Warm (#f59e0b), Cold (#94a3b8)
- Mostra se a proporcao de leads Hot esta melhorando

**Direita — Distribuicao por ICP (pie/donut chart)**
- Titulo: "Leads por Cluster de ICP"
- 3 segmentos:
  - "Mineradoras Mid-Market" (ICP Ideal): 42% — verde
  - "Construtoras Regionais": 35% — azul
  - "Anti-ICP: Micro-empresas": 23% — vermelho/cinza
- Numero central: 287 leads ativos

---

### 6.2 Lead Scoring (/obtain/leads)

**Header:** "Lead Scoring Preditivo" + badge Obtain Sense

**Barra de filtros:**
- Busca: "Buscar lead por nome ou empresa..."
- Select: Tier (Todos, Hot, Warm, Cold, Desqualificado)
- Select: Campanha (5 campanhas mock)
- Select: ICP Cluster (3 clusters)
- Select: Responsavel
- Slider: Score minimo (0-100)
- Botao: "Exportar CSV"

**Tabela de leads:**

| Coluna | Formato |
|--------|---------|
| Lead | Nome do contato (bold) + empresa abaixo em cinza |
| Score | Numero grande (0-100) com cor (Hot>=80 verde, Warm 50-79 amarelo, Cold 30-49 cinza, <30 vermelho) |
| Tier | Badge: Hot (bg verde #10B981, texto branco), Warm (bg amarelo), Cold (bg cinza), Disqualified (bg vermelho) |
| LTV Previsto | R$ formatado |
| ICP Cluster | Nome do cluster com badge |
| Campanha | Nome da campanha |
| Status | Badge: Novo, Qualificando, Contactado, Proposta, Ganho, Perdido |
| Ultima Acao | Data relativa + tipo (call, email, demo) |
| | Botao "Ver detalhes" |

- Default: ordenado por score descendente
- Linhas Hot: fundo levemente esverdeado (#ecfdf5)
- Paginacao: 20 por pagina

**20 leads mock:**
```
Rafael Mendes | Mineradora Cristalina LTDA | Score 94 | Hot | LTV R$1.2M | ICP 1 | Indicacao | Proposta
Luciana Torres | Terraplenagem Nacional SA | Score 88 | Hot | LTV R$890k | ICP 1 | Feira | Demo
Carlos Andrade | Construtora Progresso GO | Score 85 | Hot | LTV R$780k | ICP 2 | LinkedIn | Qualificando
Marina Silva | AgroPecus Maquinas LTDA | Score 82 | Hot | LTV R$650k | ICP 2 | Indicacao | Contactado
Pedro Henrique | Mineracao Araguaia | Score 78 | Warm | LTV R$920k | ICP 1 | Feira | Demo
Fernanda Lopes | Pavimentadora Centro-Oeste | Score 74 | Warm | LTV R$560k | ICP 2 | LinkedIn | Qualificando
Jorge Almeida | Britagem Serra Azul | Score 71 | Warm | LTV R$480k | ICP 2 | Google Ads | Novo
Ana Beatriz | Irrigacao Planaltina | Score 68 | Warm | LTV R$340k | ICP 2 | Outbound | Contactado
Roberto Dias | Siderurgica Vale do Araguaia | Score 65 | Warm | LTV R$720k | ICP 1 | Feira | Qualificando
Thiago Costa | Empreiteira Sol Nascente | Score 58 | Warm | LTV R$290k | ICP 2 | Google Ads | Novo
Camila Ribeiro | Transportes Rodoviarios GO | Score 52 | Warm | LTV R$210k | ICP 2 | Outbound | Contactado
Marcos Vinicius | Ceramica Tocantins | Score 45 | Cold | LTV R$120k | Anti-ICP | Google Ads | Novo
Juliana Moreira | Borracharia Industrial ME | Score 38 | Cold | LTV R$45k | Anti-ICP | Outbound | Novo
Ricardo Prado | Oficina Mecanica Goiania | Score 32 | Cold | LTV R$35k | Anti-ICP | Google Ads | Novo
Felipe Santos | Serralheria Tocantins ME | Score 28 | Disqualified | LTV R$18k | Anti-ICP | Outbound | Novo
Amanda Nunes | Construtora Boa Vista SA | Score 76 | Warm | LTV R$580k | ICP 2 | LinkedIn | Proposta
Lucas Ferreira | Mineracao Planalto Central | Score 91 | Hot | LTV R$1.1M | ICP 1 | Indicacao | Demo
Beatriz Gomes | AgriTech Cerrado LTDA | Score 72 | Warm | LTV R$420k | ICP 2 | Feira | Qualificando
Diego Martins | Pedreira Regional DF | Score 63 | Warm | LTV R$380k | ICP 2 | LinkedIn | Novo
Isabela Santos | Micro Servicos ME | Score 22 | Disqualified | LTV R$12k | Anti-ICP | Outbound | Novo
```

**Drawer lateral (abre ao clicar em "Ver detalhes")**

Similar ao drawer do Retain, mas com acento VERDE #10B981.

**Cabecalho:**
- Nome do lead (24px bold)
- Empresa abaixo
- Badge de tier (Hot verde)

**Secao 1: Score + metricas (3 mini-cards)**
- Score: 94/100 (gauge circular verde)
- LTV Previsto: R$ 1.2M
- Prob. Conversao: 87%

**Secao 2: SHAP Waterfall (VERDE)**
Mesmo componente do Retain mas com barras verdes (fatores positivos = aumentam chance de conversao) e vermelhas (diminuem).

Mock para "Rafael Mendes — Mineradora Cristalina":
```json
[
  {"label": "Setor alinhado ao ICP Cluster 1", "impact": 0.22, "direction": "positive"},
  {"label": "Empresa com +800 funcionarios", "impact": 0.15, "direction": "positive"},
  {"label": "Veio de indicacao de cliente ativo", "impact": 0.12, "direction": "positive"},
  {"label": "Regiao Centro-Oeste (GO)", "impact": 0.08, "direction": "positive"},
  {"label": "Ja agendou demo", "impact": 0.10, "direction": "positive"},
  {"label": "Tempo sem contato (5 dias)", "impact": -0.04, "direction": "negative"}
]
```

NOTA: No Obtain, barras verdes = fatores que AUMENTAM a chance de conversao (bom). Barras vermelhas = fatores que DIMINUEM (ruim). Inverso do Retain onde vermelho = aumenta churn.

**Secao 3: Oferta Recomendada (Next Best Offer)**
- Card com borda esquerda verde grossa, fundo levemente esverdeado
- Titulo: "Oferta Recomendada"
- Badge: "72% de conversao neste perfil"
- Texto: "Diagnostico Executivo de Frota — R$ 35.000 a R$ 55.000"
- Subtexto: "Clientes do ICP Cluster 1 que recebem esta oferta convertem 72% mais que a media"
- Botao: "Registrar acao" (verde)

**Secao 4: ICP Match**
- Nome do cluster: "Mineradoras Mid-Market Centro-Oeste"
- Similaridade: 94%
- Barra de progresso verde

**Secao 5: Informacoes do lead**
- Grid 2 colunas: empresa, setor, porte, cidade/UF, telefone, email, campanha de origem, data de entrada, responsavel

---

### 6.3 ICP & Lookalike (/obtain/icp)

**Header:** "Perfil de Cliente Ideal (ICP)" + badge Obtain Sense

**Secao 1: Galeria de clusters (3 cards grandes, grid horizontal)**

Cada card ocupa ~33% da largura:

**Card 1: "Mineradoras Mid-Market Centro-Oeste" — ICP IDEAL**
- Badge: "ICP Ideal" (fundo verde, texto branco)
- Icone estrela dourada
- Descricao: "Empresas de mineracao com 200-1000 funcionarios na regiao Centro-Oeste"
- Grid de metricas:
  - LTV medio: R$ 1.08M
  - Taxa conversao: 38%
  - Churn rate: 2.1%
  - CAC medio: R$ 3.200
  - Leads no funil: 48
- Barra: % dos leads que sao deste cluster (42%)
- Botao: "Exportar audiencia Lookalike"

**Card 2: "Construtoras Regionais em Expansao" — ICP BOM**
- Badge: "ICP Bom" (fundo azul, texto branco)
- Descricao: "Construtoras medias em expansao, buscando locacao de longo prazo"
- Grid de metricas:
  - LTV medio: R$ 540k
  - Taxa conversao: 24%
  - Churn rate: 4.5%
  - CAC medio: R$ 5.800
  - Leads no funil: 102
- Barra: 35%

**Card 3: "Anti-ICP: Micro-empresas Alta Rotatividade"**
- Badge: "Anti-ICP" (fundo vermelho, texto branco)
- Icone de alerta
- Descricao: "Micro-empresas com <50 funcionarios. Contratos curtos, alto churn, baixo LTV."
- Grid de metricas:
  - LTV medio: R$ 85k
  - Taxa conversao: 12%
  - Churn rate: 18%
  - CAC medio: R$ 4.100
  - Leads no funil: 67
- Barra: 23%
- Alerta vermelho: "Gasta 32% do budget mas gera apenas 8% da receita retida"

**Secao 2: Grafico Radar comparativo**
- Titulo: "Comparativo de Clusters"
- Radar/spider chart com 5 eixos: LTV, Conversao, Retencao, Ticket, Volume
- 3 poligonos sobrepostos (um por cluster, cores distintas)
- Legenda

**Secao 3: Insight (card destaque)**
- "O ICP Cluster 1 (Mineradoras Mid-Market) tem 3.2x mais LTV que o Anti-ICP. Realocar 30% do budget de Google Ads para LinkedIn pode aumentar o ROI em 45%."
- Badge: "Dados do Retain Sense: clientes do Cluster 1 tem Health Score medio de 84"

---

### 6.4 Funil & Gargalos (/obtain/funnel)

**Header:** "Analise de Funil e Gargalos" + badge Obtain Sense

**Secao 1: Funil visual (full width)**
Representacao visual do funil horizontal:
- 5 blocos conectados por setas, cada bloco com largura proporcional ao volume
- Cada bloco mostra: nome da etapa, quantidade de leads, % do total
- Entre cada bloco: indicador de drop-off ("31% perdidos") com seta para baixo vermelha
- **GARGALO DESTACADO:** A transicao "Demo -> Proposta" tem borda vermelha, icone de alerta, fundo rosado
  - Tooltip: "Tempo medio: 18 dias (2.5x acima do ideal)"

```
[Prospeccao: 287] --31% drop--> [Qualificacao: 198] --55% drop--> [Demo: 89] --49% drop (GARGALO)--> [Proposta: 45] --73% drop--> [Fechado: 12]
```

**Secao 2: Metricas por estagio (tabela)**

| Estagio | Leads | Tempo Medio | Drop-off | Leads Hot Travados | Receita Presa (LTV) |
|---------|-------|-------------|----------|-------------------|---------------------|
| Prospeccao | 287 | — | — | 12 | R$ 14.4M |
| Qualificacao | 198 | 5 dias | 31% | 8 | R$ 9.6M |
| Demo | 89 | 8 dias | 55% | 6 | R$ 7.2M |
| **Proposta** | **45** | **18 dias** ⚠️ | **49%** | **4** | **R$ 4.8M** |
| Fechado | 12 | 12 dias | 73% | — | — |

Linha "Proposta" com fundo rosado e icone de alerta.

**Secao 3: Alertas e insights (cards)**
- "23 leads Hot parados em Proposta ha mais de 7 dias — R$ 12.4M em LTV em risco"
- "Leads de Indicacao passam por Demo -> Proposta 2.3x mais rapido que Outbound"
- "Leads Cold em Prospeccao ha mais de 30 dias: considerar desqualificar 34 leads"

---

### 6.5 CAC vs LTV (/obtain/cac-ltv)

**Header:** "Eficiencia de Aquisicao: CAC vs LTV" + badge Obtain Sense

**Secao 1: Matriz visual (scatter plot grande, full width, 400px altura)**
Mesmo scatter plot do dashboard, mas maior e mais detalhado:
- 4 quadrantes com cores de fundo e labels
- Cada ponto e um circulo cujo tamanho representa o volume de leads
- Ao clicar no ponto, mostra detalhes da campanha
- Linhas de referencia tracejadas (CAC meta = R$4.500, LTV meta = R$500k)

**Secao 2: Tabela de campanhas**

| Campanha | Canal | Leads | CAC | LTV Medio | ROI Projetado | Status |
|----------|-------|-------|-----|-----------|---------------|--------|
| Indicacao de clientes | Referral | 156 | R$ 2.100 | R$ 890k | 423x | Badge "Escalar" (verde) |
| Feira AgroBrasilia 2025 | Evento | 87 | R$ 8.500 | R$ 720k | 84x | Badge "Bom" (azul) |
| LinkedIn Ads - Mineracao | Paid Social | 134 | R$ 5.200 | R$ 540k | 103x | Badge "Bom" (azul) |
| Google Ads - Equipamentos | Paid Search | 245 | R$ 3.800 | R$ 180k | 47x | Badge "Atencao" (amarelo) |
| Prospeccao Outbound | Outbound | 178 | R$ 12.000 | R$ 150k | 12x | Badge "Interromper" (vermelho) |

**Secao 3: Alerta de retroalimentacao (card destaque)**
- Icone de loop/setas circulares
- Badge: "Dados do Retain Sense"
- "Campanha Outbound gera leads com churn medio de 4 meses. CAC de R$ 12.000 nao se paga. Clientes dessa origem tem Health Score medio de 32 (critico)."
- "Sugestao: realocar 80% do budget de Outbound para Indicacao (+150% de ROI estimado)"

---

### 6.6 Simulador ROI Aquisicao (/obtain/roi)

**Layout: 2 colunas, similar ao Retain mas com metricas de aquisicao**

**Coluna esquerda — Inputs:**
- Slider: Volume de leads/mes (50-2000, default 250)
- Slider: Taxa de conversao atual % (5-50, default 24)
- Slider: CAC atual R$ (500-20.000, default 5.200)
- Slider: LTV medio atual R$ (50.000-2.000.000, default 540.000)
- Slider: Investimento mensal em marketing R$ (10.000-500.000, default 120.000)
- Botao: "Calcular ROI"

**Coluna direita — 3 cenarios:**
- Conservador: -15% CAC, +10% conversao, +10% LTV
- Esperado (destaque): -25% CAC, +20% conversao, +15% LTV
- Otimista: -35% CAC, +30% conversao, +25% LTV

Cada cenario mostra:
- Economia anual em CAC: R$ X
- Receita adicional (novos clientes x LTV): R$ Y
- ROI do Obtain Sense: X%
- Payback: X meses

**Abaixo:** Texto destaque + botao CTA (verde esmeralda)

---

### 6.7 Upload de Leads (/obtain/upload)

Mesmo pattern do Retain upload, mas adaptado:
- Drag-and-drop para CSV de leads
- Mapeamento de colunas: nome, email, empresa, setor, porte da empresa, cidade, estado, origem/campanha, status, responsavel
- Processamento: scoring automatico apos upload
- Resultado: "287 leads importados. 34 classificados como Hot. Ver lead scoring ->"

---

## 7. PAGINA DE CONFIGURACOES (/settings)

**Tabs:** Perfil | Empresa | Setor | Usuarios

**Tab Perfil:** Avatar, nome, email, alterar senha

**Tab Empresa:** Nome, CNPJ, endereco, plano atual (badge)

**Tab Setor (CRITICO):**
- Select: Setor (Industrial B2B, Telecom, Fintech, SaaS, Saude, Educacao, Varejo, Personalizado)
- Ao selecionar, pre-preenche os campos:
  - Label para "cliente": input
  - Label para "receita": input
  - Label para "engajamento": input
  - Label para "suporte": input
  - Segmentos: tags editaveis (adicionar/remover)
  - Moeda: select (BRL, USD, EUR)
- **Preview em tempo real:** mini-card mostrando como ficam os labels na interface
- Botao: "Salvar configuracao"

**Tab Usuarios:** Tabela de usuarios do tenant + botao "Convidar usuario"

---

## 8. COMPONENTES REUTILIZAVEIS

### 8.1 MetricCard
Card de KPI usado em todos os dashboards. Props:
- icon: Lucide icon name
- label: string (do sectorConfig)
- value: string formatado
- change: number (variacao %)
- changeDirection: "up" | "down"
- changeIsGood: boolean (churn caindo = bom)
- accentColor: string (azul para Retain, verde para Obtain)

### 8.2 RiskBadge / ScoreBadge
Badge com cor por nivel. RiskBadge: Low/Medium/High/Critical (Retain). ScoreBadge: Hot/Warm/Cold/Disqualified (Obtain).

### 8.3 ShapWaterfall
O componente mais diferenciado. Grafico waterfall horizontal mostrando contribuicao de cada fator. Props:
- factors: array de {label, impact, direction}
- baseProbability: number
- finalProbability: number
- positiveColor: string (#ef4444 para Retain = fatores de risco, #10B981 para Obtain = fatores de conversao)
- negativeColor: string (#10B981 para Retain = protetores, #ef4444 para Obtain = detratores)

### 8.4 DataTable
Tabela generica com: ordenacao, filtros inline, paginacao, selecao multipla, rows com destaque condicional.

### 8.5 DetailDrawer
Drawer lateral deslizante (Sheet/SlideOver) com cabecalho, secoes, e acoes.

### 8.6 ColumnMapper
Interface de mapeamento de colunas CSV para dimensoes do sistema.

### 8.7 ROICalculator
Calculadora interativa com sliders e cenarios calculados.

### 8.8 FunnelChart
Funil horizontal/vertical com etapas, volumes, drop-offs e destaque de gargalos.

### 8.9 QuadrantMatrix
Scatter plot 2x2 com quadrantes coloridos e pontos clicaveis.

---

## 9. REQUISITOS TECNICOS

- **Framework:** React 18 com TypeScript
- **Estilizacao:** Tailwind CSS
- **Componentes UI:** shadcn/ui (Card, Button, Badge, Input, Select, Table, Tabs, Sheet, Dialog, DropdownMenu, Tooltip, Progress, Separator, Slider)
- **Graficos:** Recharts (AreaChart, BarChart, PieChart, RadarChart, ScatterChart, customizado para Waterfall e Funnel)
- **Icones:** Lucide React
- **Roteamento:** React Router ou Wouter
- **Estado:** React Context para auth + sectorConfig, React Query para dados API
- **Idioma:** Portugues do Brasil (todos textos, labels, botoes)
- **Responsivo:** Desktop-first, sidebar colapsavel

---

## 10. RESUMO DE ROTAS E PAGINAS

| Rota | Pagina | Modulo | Prioridade |
|------|--------|--------|-----------|
| /login | Login | Shell | P0 |
| / | Ciclo de Vida (Overview) | Shell | P0 |
| /retain | Dashboard Executivo | Retain | P0 |
| /retain/predictions | Predicoes de Churn | Retain | P0 |
| /retain/root-causes | Causas Raiz | Retain | P1 |
| /retain/roi | Simulador ROI | Retain | P0 |
| /retain/customers | Clientes | Retain | P1 |
| /retain/upload | Upload Dados | Retain | P1 |
| /obtain | Dashboard Executivo | Obtain | P0 |
| /obtain/leads | Lead Scoring | Obtain | P0 |
| /obtain/icp | ICP & Lookalike | Obtain | P0 |
| /obtain/funnel | Funil & Gargalos | Obtain | P1 |
| /obtain/cac-ltv | CAC vs LTV | Obtain | P0 |
| /obtain/roi | Simulador ROI | Obtain | P1 |
| /obtain/upload | Upload Leads | Obtain | P1 |
| /settings | Configuracoes | Shell | P2 |

Total: 16 paginas (1 login + 15 internas)
