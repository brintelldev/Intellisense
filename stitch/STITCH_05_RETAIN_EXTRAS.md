# Prompt 5/8 — Retain Sense: ROI + Causas Raiz + Clientes

Crie 3 paginas do modulo Retain Sense: Simulador de ROI, Causas Raiz e Clientes.

## Design System resumido
- Fonte: Inter. Cor acento: azul #293b83, teal #67b4b0. Fundo #f8fafc, cards brancos shadow-sm rounded-xl. Recharts. shadcn/ui. Lucide. PT-BR.

---

## Pagina 1: Simulador ROI (/retain/roi)

**Header:** "Simulador de ROI" + badge "Retain Sense" azul. Subtitulo: "Calcule o impacto financeiro de reduzir o churn"

**Layout: 2 colunas (esquerda 45%, direita 55%)**

### Coluna esquerda — Inputs
Card branco com titulo "Configure sua simulacao" (16px SemiBold):

4 sliders (usar shadcn/ui Slider), cada um com:
- Label acima (14px)
- Slider com thumb colorido #293b83
- Valor atual mostrado em bold a direita do slider

| Slider | Range | Default | Formato |
|--------|-------|---------|---------|
| Total de empresas ativas | 100–5000 (step 10) | 482 | numero inteiro |
| Valor medio do contrato/mes | R$ 1.000–200.000 (step 1.000) | R$ 45.000 | R$ formatado |
| Taxa de churn atual | 1.0%–15.0% (step 0.1) | 3.8% | porcentagem |
| Melhoria esperada com Retain Sense | 10%–50% (step 5) | 25% | porcentagem |

Botao "Calcular ROI" (full width, fundo #293b83, texto branco, height 44px)

### Coluna direita — Resultados (3 cards empilhados)

**Card 1: Cenario Conservador (15%)**
- Fundo branco, borda cinza sutil
- Titulo: "Cenario Conservador" (14px SemiBold cinza) + badge "15% melhoria" cinza
- 3 metricas em linha:
  - Empresas retidas/ano: **3**
  - Receita preservada/mes: **R$ 123K**
  - Receita preservada/ano: **R$ 1.47M**

**Card 2: Cenario Esperado (25%)** — DESTAQUE
- Borda 2px gradiente #293b83 para #67b4b0
- Badge "Recomendado" (fundo gradiente, texto branco) no canto superior direito
- Titulo: "Cenario Esperado" (16px Bold)
- 3 metricas em linha (valores maiores, fontes um pouco maiores):
  - Empresas retidas/ano: **5**
  - Receita preservada/mes: **R$ 205K**
  - Receita preservada/ano: **R$ 2.46M**

**Card 3: Cenario Otimista (40%)**
- Fundo branco, borda cinza sutil
- Titulo: "Cenario Otimista" + badge "40% melhoria"
- 3 metricas em linha:
  - Empresas retidas/ano: **7**
  - Receita preservada/mes: **R$ 328K**
  - Receita preservada/ano: **R$ 3.94M**

**Bloco de destaque (full width abaixo dos cards):**
- Fundo gradiente muito sutil (#f0f4ff)
- Texto 20px Bold centralizado: "Com o Retain Sense, voce pode preservar ate **R$ 2.46M por ano**"
- Subtexto 14px cinza: "Baseado em benchmarks de retencao B2B do setor industrial"
- Botao CTA: "Solicitar demonstracao personalizada" (gradiente #293b83→#67b4b0, texto branco, padding 16px 32px, rounded-lg)

---

## Pagina 2: Causas Raiz (/retain/root-causes)

**Header:** "Analise de Causas Raiz" + badge "Retain Sense". Subtitulo: "Principais motivos de cancelamento"

### Secao 1: Resumo (3 MetricCards, grid 3 colunas)
- Empresas Churned (12 meses): **47** (icone UserMinus)
- Principal Causa: **"Vencimento sem renovacao"** (icone AlertTriangle)
- Receita Perdida: **R$ 2.1M** (icone TrendingDown, vermelho)

### Secao 2: Grid 2 colunas

**Esquerda — Tabela de causas:**

| Causa | Categoria | Impacto | Afetados | Receita Risco |
|-------|-----------|---------|----------|---------------|
| Atraso recorrente no pagamento | Financeiro | 28% | 34 | R$ 412K |
| Vencimento contrato sem renovacao | Contratual | 22% | 28 | R$ 367K |
| Baixa utilizacao de equipamentos | Engajamento | 18% | 22 | R$ 198K |
| Volume alto de chamados | Suporte | 15% | 19 | R$ 156K |
| NPS detrator (< 6) | Satisfacao | 12% | 15 | R$ 134K |
| Reducao de servicos contratados | Uso | 5% | 6 | R$ 67K |

Coluna "Impacto" com barra de progresso horizontal proporcional + porcentagem.

**Direita — Bar Chart horizontal** espelhando as mesmas causas, barras coloridas por categoria:
- Financeiro: #ef4444, Contratual: #f97316, Engajamento: #f59e0b, Suporte: #3b82f6, Satisfacao: #8b5cf6, Uso: #6b7280

### Secao 3: Tendencia mensal (Line Chart)
Card com titulo "Tendencia de Causas — Ultimos 6 Meses":
- 4 linhas (Financeiro, Contratual, Engajamento, Suporte)
- Eixo X: Out/25 a Mar/26
- Legenda colorida abaixo

---

## Pagina 3: Clientes (/retain/customers)

**Header:** "Base de Clientes" + badge "Retain Sense"

### Barra de filtros
- Busca: "Buscar por nome ou codigo..."
- Select: Segmento
- Select: Status (Ativo, Em Risco, Churned)
- Select: Risco (Baixo, Medio, Alto, Critico)
- 2 inputs lado a lado: "Receita min" e "Receita max" (R$)
- Botao "Exportar CSV" + Botao "Adicionar empresa"

### Tabela
Mesmos 20 clientes do prompt 4, com colunas adicionais:
- Checkbox (selecao)
- Nome + codigo
- Segmento (badge)
- Cidade/UF
- Valor Contrato (R$)
- Tempo parceria ("X meses")
- Health Score (barra mini + numero)
- Risco (badge)
- Status (badge: Ativo=#22c55e, Em Risco=#f59e0b, Churned=#ef4444)
- Ultima Atividade (data relativa)

Paginacao: 20 por pagina. Ordenacao clicavel. Selecao multipla com acao em lote no topo: "Criar acao de retencao para X selecionados".
