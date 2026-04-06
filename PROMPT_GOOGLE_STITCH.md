# RetainSense — Prompt para Google Stitch

## Visao Geral da Aplicacao

Crie o frontend completo de uma plataforma SaaS B2B chamada **RetainSense** — uma plataforma de inteligencia de churn que preve quais clientes vao sair, explica os motivos com IA (SHAP values) e orienta acoes de retencao. A plataforma e generica (funciona para qualquer setor: industrial, telecom, fintech, saude, SaaS etc.). O admin configura o setor do tenant e a plataforma ajusta terminologia automaticamente.

A aplicacao e multi-tenant: cada empresa cliente (tenant) acessa apenas seus proprios dados. O frontend consome uma API REST (nao precisa implementar o backend, use dados mockados realistas).

---

## Identidade Visual (OBRIGATORIO — seguir rigorosamente)

### Cores da marca
- **Azul escuro (primaria):** #293b83 — headers, botoes primarios, sidebar, textos de destaque
- **Verde:** #64b783 — indicadores positivos, health scores altos, badges de sucesso, CTAs secundarios
- **Teal/Verde-azulado:** #67b4b0 — acentos, graficos, links, hover states
- **Preto:** #000000 — textos principais
- **Cinza:** #b4b4b4 — textos secundarios, bordas, placeholders
- **Branco:** #ffffff — backgrounds, cards

### Gradiente da marca
- Usar gradiente de #293b83 para #67b4b0 em elementos de destaque (header, hero sections, barras de progresso premium)

### Tipografia
- **Fonte unica:** Inter (Google Fonts)
- Titulos: Inter SemiBold/Bold
- Corpo: Inter Regular
- Dados/numeros: Inter Medium (tabular numbers)

### Tom visual
- Clean, profissional, data-driven
- Espacamento generoso (nao apertado)
- Cards com sombra sutil (shadow-sm)
- Bordas arredondadas (rounded-lg)
- Dark mode NAO e necessario — apenas light mode

### Logo
- Escudo com olho e circuitos integrados, gradiente azul-para-teal
- Texto: "Retain Sense" em Inter, onde "Retain" e azul escuro (#293b83) e "Sense" e teal (#67b4b0)
- Subtitulo: "Predictive Retention Powered by Brintell." em cinza (#b4b4b4)
- Usar a versao horizontal na sidebar e a versao vertical na tela de login

---

## Estrutura de Navegacao

### Sidebar (fixa a esquerda, colapsavel)
- Logo RetainSense (versao horizontal, menor)
- Nome do tenant ativo (ex: "DCCO Distribuicao")
- Separador
- Menu:
  - Dashboard Executivo (icone: LayoutDashboard) — rota /
  - Predicoes (icone: BrainCircuit) — rota /predictions
  - Causas Raiz (icone: SearchCode) — rota /root-causes
  - Simulador ROI (icone: Calculator) — rota /roi
  - Clientes (icone: Users) — rota /customers
  - Upload de Dados (icone: Upload) — rota /upload
  - Configuracoes (icone: Settings) — rota /settings
- Separador
- Rodape: avatar do usuario + nome + botao de logout
- A sidebar quando colapsada mostra apenas os icones

### Header (topo, dentro da area de conteudo)
- Breadcrumb: Dashboard > [pagina atual]
- Direita: botao de notificacoes + avatar do usuario

---

## Paginas Detalhadas

### 1. Tela de Login (/login)

Layout centralizado com fundo branco. Card central com:
- Logo RetainSense (versao vertical, tamanho grande)
- Titulo: "Acesse sua conta"
- Campo: Email (input com icone de envelope)
- Campo: Senha (input com icone de cadeado + toggle de visibilidade)
- Checkbox: "Manter conectado"
- Botao primario: "Entrar" (fundo #293b83, texto branco, full width)
- Link: "Esqueceu a senha?"
- Separador com texto "ou"
- Botao secundario: "Criar conta" (outline, borda #293b83)
- Rodape: "Powered by Brintell" em cinza

**Tela de Registro** (modal ou pagina separada):
- Campos: Nome completo, Email, Senha, Confirmar senha
- Select: Setor da empresa (Industrial B2B, Telecom, Fintech, SaaS, Saude, Educacao, Outro)
- Campo: Nome da empresa
- Botao: "Criar conta"

---

### 2. Dashboard Executivo (/) — PAGINA PRINCIPAL

Esta e a pagina mais importante. Deve ser visualmente impactante e transmitir valor imediato.

#### Secao 1: KPIs (4 cards em grid horizontal)
Cada card tem: icone, label, valor grande, variacao percentual (seta verde/vermelha + % vs mes anterior)

| Card | Label | Valor mock | Variacao |
|------|-------|-----------|----------|
| 1 | Total de Clientes Ativos | 482 | +2.3% |
| 2 | Taxa de Churn | 3.8% | -0.5% (verde, churn caiu) |
| 3 | Receita Mensal (MRR) | R$ 21.7M | +1.2% |
| 4 | Receita em Risco | R$ 847K | +12.4% (vermelho) |

**IMPORTANTE:** Os labels desses KPIs devem ser dinamicos. O sistema usa um objeto `sectorConfig` que define a terminologia. Exemplo:
```typescript
const sectorConfig = {
  customerLabel: "Empresa",      // poderia ser "Assinante", "Conta", "Paciente"
  customersLabel: "Empresas",
  revenueLabel: "Valor dos Contratos",  // poderia ser "MRR", "Mensalidade"
  engagementLabel: "Utilizacao de Equipamentos",
  ticketLabel: "Chamados Tecnicos",
  tenureLabel: "Tempo de Parceria",
  segments: ["Mineracao", "Construcao Civil", "Agropecuaria", "Industrial"],
  currency: "BRL"
};
```

#### Secao 2: Graficos (grid 2 colunas)

**Grafico esquerda — Tendencia de Churn (area chart)**
- Eixo X: ultimos 12 meses (Abr 2025 — Mar 2026)
- Eixo Y: taxa de churn (%)
- Area preenchida com gradiente #293b83 para transparente
- Linha de tendencia tracejada
- Tooltip com valor exato ao passar o mouse
- Dados mock: oscilar entre 3.2% e 5.1%, com tendencia de queda nos ultimos 3 meses

**Grafico direita — Distribuicao de Risco (donut chart)**
- Segmentos: Baixo (verde #64b783), Medio (amarelo #f59e0b), Alto (laranja #f97316), Critico (vermelho #ef4444)
- Valores mock: Baixo 312, Medio 98, Alto 52, Critico 20
- Numero central: total de clientes (482)
- Legenda abaixo do grafico

#### Secao 3: Graficos adicionais (grid 2 colunas)

**Grafico esquerda — Receita por Segmento (bar chart horizontal)**
- Barras horizontais, uma por segmento do sectorConfig.segments
- Cores: gradiente da marca
- Valores mock em R$ (Mineracao: R$8.2M, Construcao: R$7.1M, Agro: R$4.3M, Industrial: R$2.1M)

**Grafico direita — Health Score Medio (gauge/speedometer)**
- Valor: 72/100
- Zonas de cor: 0-40 vermelho, 40-60 amarelo, 60-80 verde claro, 80-100 verde escuro
- Texto abaixo: "Saude media da base" (usar sectorConfig.customersLabel)

#### Secao 4: Alertas recentes (lista compacta)
- 5 alertas com icone de severidade (vermelho/amarelo), nome do cliente, mensagem curta, tempo
- Exemplos:
  - "Mineradora Vale Norte Ltda — Churn probability subiu para 89% — ha 2h"
  - "Construtora Horizonte SA — Contrato vence em 7 dias, sem renovacao — ha 5h"
  - "AgroPlan Mecanizacao — 3 chamados tecnicos abertos esta semana — ha 1d"

---

### 3. Dashboard de Predicoes (/predictions)

#### Secao superior: Filtros
- Barra de filtros horizontal:
  - Busca por nome/codigo (input com icone de lupa)
  - Dropdown: Nivel de Risco (Todos, Baixo, Medio, Alto, Critico)
  - Dropdown: Segmento (do sectorConfig.segments)
  - Dropdown: Status (Ativo, Em Risco, Churned)
  - Botao: "Exportar CSV"

#### Secao principal: Tabela de clientes
Tabela com as colunas:
| Coluna | Descricao |
|--------|-----------|
| Cliente | Nome da empresa + codigo |
| Segmento | Badge colorido (Mineracao, Construcao etc.) |
| Receita Mensal | Valor em R$ |
| Health Score | Barra de progresso colorida (0-100) |
| Churn Probability | Porcentagem com badge de cor |
| Risco | Badge: Baixo (verde), Medio (amarelo), Alto (laranja), Critico (vermelho) |
| Tendencia | Seta para cima/baixo (se o risco aumentou/diminuiu vs mes anterior) |
| Acoes | Botao "Ver detalhes" |

- Paginacao: 20 itens por pagina
- Ordenacao por qualquer coluna (default: churn probability desc)
- Linhas de risco critico/alto com fundo levemente rosado

#### Drawer lateral (abre ao clicar em "Ver detalhes")
Painel deslizante da direita (largura ~480px) com:

**Cabecalho:**
- Nome da empresa (grande)
- Badge de risco
- Codigo do cliente
- Segmento

**Secao 1: Score Cards (3 mini-cards)**
- Health Score: 34/100 (barra vermelha)
- Churn Probability: 87% (texto vermelho)
- Receita Mensal: R$ 45.200

**Secao 2: SHAP Waterfall Chart (MUITO IMPORTANTE)**
Grafico de waterfall horizontal mostrando os top 5 fatores que mais impactam a predicao de churn deste cliente:

```
Base (probabilidade media) ------> 15%
  + Atraso no pagamento (22 dias)  ████████████  +28%
  + Contrato vence em 15 dias      ██████████    +22%
  + Baixa utilizacao (35%)         ████████      +18%
  + Alto vol. chamados (8)         ██████        +15%
  - Parceria longa (36 meses)      ████████      -11%
                                   ============
Predicao final -----------------> 87%
```

- Barras vermelhas para fatores que AUMENTAM o risco
- Barras verdes para fatores que DIMINUEM o risco (protetores)
- Cada barra mostra o nome do fator + valor real entre parenteses + contribuicao percentual
- Linha base a esquerda, predicao final a direita
- Este grafico e o diferencial tecnico da plataforma — deve ser bonito e claro

**Secao 3: Acao Recomendada**
- Card com borda esquerda colorida (azul)
- Titulo: "Acao Recomendada"
- Texto: "Agendar reuniao de renovacao com desconto de 5-10% para contrato de 12 meses. Priorizar resolucao dos chamados tecnicos pendentes."
- Botao: "Criar acao de retencao"

**Secao 4: Informacoes do cliente**
- Grid 2 colunas com dados:
  - Cidade/Estado, Tempo de parceria, NPS, Total de servicos, Ultimo contato
  - Dados formatados com labels do sectorConfig

---

### 4. Causas Raiz (/root-causes)

#### Secao 1: Resumo (3 cards)
- Total de clientes churned (ultimos 12 meses): 47
- Principal causa: "Vencimento de contrato sem renovacao"
- Receita total perdida: R$ 2.1M

#### Secao 2: Ranking de Causas (tabela + bar chart)

**Lado esquerdo — Tabela:**
| Causa | Categoria | % de Impacto | Clientes Afetados | Receita em Risco |
|-------|-----------|-------------|-------------------|-----------------|
| Atraso recorrente no pagamento | Financeiro | 28% | 34 | R$ 412K |
| Vencimento de contrato | Contratual | 22% | 28 | R$ 367K |
| Baixa utilizacao de equipamentos | Engajamento | 18% | 22 | R$ 198K |
| Volume alto de chamados | Suporte | 15% | 19 | R$ 156K |
| NPS detrator (<6) | Satisfacao | 12% | 15 | R$ 134K |
| Reducao de servicos contratados | Uso | 5% | 6 | R$ 67K |

**Lado direito — Bar chart horizontal** com as mesmas causas, barras coloridas por categoria

#### Secao 3: Tendencia mensal
- Line chart com 3-4 linhas (uma por categoria principal)
- Eixo X: ultimos 6 meses
- Legenda colorida

---

### 5. Simulador ROI (/roi) — CRITICO PARA CONVERSAO

Layout em duas colunas: esquerda = inputs, direita = resultados.

#### Coluna esquerda: Inputs
Card com titulo "Configure sua simulacao":
- **Slider:** Total de clientes ativos (100–5000, default 482)
- **Slider:** Receita media por cliente/mes em R$ (1.000–200.000, default 45.000)
- **Slider:** Taxa de churn atual % (1–15, default 3.8)
- **Slider:** Melhoria esperada com RetainSense % (10–50, default 25)
- Botao: "Calcular ROI"

#### Coluna direita: Resultados
Tres cards de cenario empilhados:

**Cenario Conservador (15% de melhoria)**
- Clientes retidos: X
- Receita preservada/mes: R$ Y
- Receita preservada/ano: R$ Z

**Cenario Esperado (25% de melhoria)** — card com borda gradiente da marca (destaque)
- Clientes retidos: X
- Receita preservada/mes: R$ Y
- Receita preservada/ano: R$ Z

**Cenario Otimista (40% de melhoria)**
- Clientes retidos: X
- Receita preservada/mes: R$ Y
- Receita preservada/ano: R$ Z

**Abaixo dos cenarios:**
- Texto grande em destaque: "Com o RetainSense, voce pode preservar ate R$ X.XXM por ano"
- Subtexto: "Baseado em benchmarks de retencao B2B do setor industrial"
- Botao CTA: "Solicitar demonstracao personalizada" (gradiente azul-teal)

---

### 6. Clientes (/customers)

Tabela completa com todas as informacoes dos clientes.

**Filtros:**
- Busca por nome/codigo
- Dropdown: Segmento
- Dropdown: Status (Ativo, Em Risco, Churned)
- Dropdown: Nivel de Risco
- Range: Receita mensal (min-max)
- Botoes: "Exportar CSV", "Adicionar cliente"

**Tabela:**
| Coluna | Formato |
|--------|---------|
| Nome | Texto + codigo pequeno abaixo |
| Segmento | Badge colorido |
| Cidade/UF | Texto |
| Receita Mensal | R$ formatado |
| Tenure | "X meses" |
| Health Score | Barra mini + numero |
| Risco | Badge |
| Status | Badge (Ativo verde, Em Risco amarelo, Churned vermelho) |
| Ultima Atividade | Data relativa ("ha 3 dias") |

- Paginacao, ordenacao, selecao multipla
- Acao em lote: "Criar acao de retencao para selecionados"

---

### 7. Upload de Dados (/upload)

#### Passo 1: Upload
- Area de drag-and-drop grande (bordas tracejadas, icone de cloud upload)
- Texto: "Arraste seu arquivo CSV ou clique para selecionar"
- Texto menor: "Formatos aceitos: .csv, .xlsx — Maximo 50MB"
- Historico de uploads anteriores abaixo (tabela simples: nome, data, linhas, status)

#### Passo 2: Mapeamento de Colunas (apos upload)
Card com titulo "Mapeie suas colunas para as dimensoes do RetainSense"

Layout de mapeamento com duas colunas:

| Dimensao RetainSense | Sua Coluna (dropdown) |
|---------------------|----------------------|
| Identificador do cliente | [dropdown com colunas do CSV] |
| Nome do cliente | [dropdown] |
| Receita | [dropdown] |
| Regularidade de pagamento | [dropdown] |
| Tempo de relacionamento | [dropdown] |
| Frequencia de interacao | [dropdown] |
| Volume de suporte | [dropdown] |
| Satisfacao | [dropdown] |
| Vinculo contratual | [dropdown] |
| Intensidade de uso | [dropdown] |
| Recencia | [dropdown] |

- O sistema sugere mapeamentos automaticos (highlight verde nas sugestoes)
- Colunas nao mapeadas ficam como "campos extras" (o ML usa tudo)
- Indicador: "7 de 11 dimensoes mapeadas — precisao estimada: Alta"
- Botao: "Confirmar e processar"

#### Passo 3: Processamento
- Progress bar animada
- Status: "Processando 500 registros... Rodando modelo de predicao... Gerando explicacoes..."
- Quando concluir: "Processamento completo! 500 clientes analisados. Ver predicoes →"

---

### 8. Configuracoes (/settings)

Tabs: Perfil | Empresa | Setor | Usuarios

**Tab Perfil:**
- Avatar, nome, email, senha (campos editaveis)

**Tab Empresa:**
- Nome da empresa, CNPJ, endereco
- Plano atual (badge)

**Tab Setor (IMPORTANTE):**
- Dropdown: Setor (Industrial B2B, Telecom, Fintech, SaaS, Saude, Educacao, Personalizado)
- Ao selecionar, pre-preenche os campos abaixo:
  - Label para "cliente": input (ex: "Empresa")
  - Label para "receita": input (ex: "Valor do Contrato")
  - Label para "engajamento": input (ex: "Utilizacao de Equipamentos")
  - Label para "suporte": input (ex: "Chamados Tecnicos")
  - Segmentos: tags editaveis (ex: Mineracao, Construcao, Agro, Industrial)
  - Moeda: dropdown (BRL, USD, EUR)
- Botao: "Salvar configuracao"
- Preview: mostra como a terminologia aparece nos dashboards

**Tab Usuarios:**
- Tabela de usuarios do tenant
- Botao "Convidar usuario"

---

## Dados Mock para Popular a Interface

Use estes dados como exemplo para popular todas as telas. O contexto e de uma empresa de distribuicao/locacao de equipamentos industriais (B2B).

### Clientes mock (use pelo menos 20 na tabela):
```
Mineradora Vale Norte Ltda — Mineracao — R$ 156.800/mes — Risco Critico — Health 18
Construtora Horizonte SA — Construcao Civil — R$ 89.400/mes — Risco Alto — Health 32
AgroPlan Mecanizacao — Agropecuaria — R$ 67.200/mes — Risco Alto — Health 38
Pedreira Goias Central — Mineracao — R$ 134.500/mes — Risco Medio — Health 55
Terraplenagem Tocantins — Construcao Civil — R$ 45.200/mes — Risco Critico — Health 22
Fazenda Sao Jorge Energia — Agropecuaria — R$ 78.900/mes — Risco Baixo — Health 82
Concreteira Planalto — Construcao Civil — R$ 112.300/mes — Risco Baixo — Health 76
Industrial Minas Gerais — Industrial — R$ 198.400/mes — Risco Medio — Health 61
Silos Araguaia LTDA — Agropecuaria — R$ 34.600/mes — Risco Alto — Health 29
Construtora Capital DF — Construcao Civil — R$ 167.800/mes — Risco Baixo — Health 85
Mineracao Serra Dourada — Mineracao — R$ 223.100/mes — Risco Medio — Health 58
LogPetro Transportes — Industrial — R$ 56.700/mes — Risco Alto — Health 35
Usina Solar Goias — Industrial — R$ 89.100/mes — Risco Baixo — Health 79
BrasilAgro Maquinas — Agropecuaria — R$ 145.600/mes — Risco Baixo — Health 88
Pavimentacao Nacional SA — Construcao Civil — R$ 78.400/mes — Risco Medio — Health 52
Cimento Norte Tocantins — Industrial — R$ 201.300/mes — Risco Baixo — Health 91
Mineracao Rio Claro — Mineracao — R$ 178.900/mes — Risco Medio — Health 64
Irrigacao Cerrado LTDA — Agropecuaria — R$ 43.200/mes — Risco Critico — Health 15
Construtora Alianca GO — Construcao Civil — R$ 95.600/mes — Risco Baixo — Health 73
Siderurgica Centro-Oeste — Industrial — R$ 312.400/mes — Risco Baixo — Health 94
```

---

## Requisitos Tecnicos

- **Framework:** React 18 com TypeScript
- **Estilizacao:** Tailwind CSS
- **Componentes UI:** shadcn/ui (usar os componentes: Card, Button, Badge, Input, Select, Table, Tabs, Sheet/Drawer, Dialog, DropdownMenu, Tooltip, Progress, Separator)
- **Graficos:** Recharts (AreaChart, BarChart, PieChart/DonutChart, customizado para Waterfall)
- **Icones:** Lucide React
- **Roteamento:** React Router ou Wouter
- **Estado:** React Context para sectorConfig + React Query para dados da API
- **Responsivo:** Desktop-first, mas sidebar colapsavel em telas menores
- **Idioma da interface:** Portugues do Brasil (todos os textos, labels, botoes em PT-BR)

---

## Componentes Reutilizaveis que devem ser criados

1. **MetricCard** — Card de KPI com icone, valor, label, variacao
2. **RiskBadge** — Badge colorido por nivel de risco (Baixo/Medio/Alto/Critico)
3. **HealthScoreBar** — Barra de progresso colorida (vermelho→amarelo→verde)
4. **ShapWaterfall** — Grafico waterfall horizontal para SHAP values
5. **CustomerDrawer** — Drawer lateral com detalhes + SHAP + acao recomendada
6. **ColumnMapper** — Interface de mapeamento de colunas CSV → dimensoes
7. **ROICalculator** — Calculadora interativa de ROI com cenarios
8. **SectorConfigProvider** — Context provider com terminologia do setor
9. **DataTable** — Tabela reutilizavel com ordenacao, filtros e paginacao
10. **AlertsList** — Lista de alertas com severidade e timestamp

---

## Notas Finais

- NAO usar dark mode. Apenas light mode com fundo branco/cinza claro (#f8fafc)
- A interface deve ser 100% em portugues do Brasil
- Valores monetarios sempre formatados com R$ e pontos de milhar (R$ 156.800)
- Datas no formato brasileiro (01/04/2026)
- O SHAP Waterfall chart e o componente mais diferenciado — ele deve ser visualmente claro, elegante e facil de entender por um executivo nao-tecnico
- Os labels dinamicos (sectorConfig) sao fundamentais — eles tornam a plataforma generica. Nenhum texto deve ser hardcoded como "assinante" ou "mensalidade"
- A sidebar deve ter o logo RetainSense no topo com o gradiente azul→teal da marca
