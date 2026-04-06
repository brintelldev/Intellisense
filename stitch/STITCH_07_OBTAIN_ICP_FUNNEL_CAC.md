# Prompt 7/8 — Obtain Sense: ICP + Funil + CAC vs LTV

Crie 3 paginas do modulo Obtain Sense: ICP & Lookalike, Funil & Gargalos, e CAC vs LTV.

## Design System resumido
- Fonte: Inter. **Cor acento: verde esmeralda #10B981.** Fundo #f8fafc, cards brancos shadow-sm rounded-xl. Recharts. shadcn/ui. Lucide. PT-BR.

---

## Pagina 1: ICP & Lookalike (/obtain/icp)

**Header:** "Perfil de Cliente Ideal (ICP)" + badge "Obtain Sense" verde. Subtitulo: "Clusters de perfil ideal baseados em dados historicos de retencao"

### Secao 1: Galeria de Clusters (grid 3 colunas, gap-6)

**Card 1: "Mineradoras Mid-Market Centro-Oeste"**
- Borda superior 4px verde #10B981
- Badge topo direito: "ICP Ideal" (fundo #10B981, texto branco)
- Icone Star dourado/amarelo ao lado do titulo
- Titulo: "Mineradoras Mid-Market Centro-Oeste" (16px SemiBold)
- Descricao: "Empresas de mineracao com 200-1000 funcionarios na regiao Centro-Oeste. Alto engajamento, contratos longos." (13px cinza)
- Separador
- Grid 2x3 de metricas (label cinza 11px + valor bold 16px):
  - LTV medio: **R$ 1.08M**
  - Taxa conversao: **38%**
  - Churn rate: **2.1%**
  - CAC medio: **R$ 3.200**
  - Leads no funil: **48**
  - % da base: **42%**
- Barra de progresso verde: 42% dos leads
- Botao outline verde: "Exportar Audiencia Lookalike" (icone Download)

**Card 2: "Construtoras Regionais em Expansao"**
- Borda superior 4px azul #3b82f6
- Badge: "ICP Bom" (fundo #3b82f6, texto branco)
- Titulo: "Construtoras Regionais em Expansao" (16px SemiBold)
- Descricao: "Construtoras medias em expansao, GO/DF/TO. Buscam locacao de longo prazo para obras de infraestrutura." (13px cinza)
- Metricas:
  - LTV medio: **R$ 540k**
  - Taxa conversao: **24%**
  - Churn rate: **4.5%**
  - CAC medio: **R$ 5.800**
  - Leads no funil: **102**
  - % da base: **35%**
- Barra azul 35%
- Botao outline: "Exportar Audiencia Lookalike"

**Card 3: "Anti-ICP: Micro-empresas Alta Rotatividade"**
- Borda superior 4px vermelha #ef4444
- Badge: "Anti-ICP" (fundo #ef4444, texto branco)
- Icone AlertTriangle vermelho
- Titulo: "Anti-ICP: Micro-empresas Alta Rotatividade" (16px SemiBold)
- Descricao: "Micro-empresas com menos de 50 funcionarios. Contratos curtos, alto churn, baixo LTV. Evitar investimento em aquisicao deste perfil." (13px cinza)
- Metricas:
  - LTV medio: **R$ 85k**
  - Taxa conversao: **12%**
  - Churn rate: **18%**
  - CAC medio: **R$ 4.100**
  - Leads no funil: **67**
  - % da base: **23%**
- Barra vermelha 23%
- Card de alerta dentro: "Gasta 32% do budget de marketing mas gera apenas 8% da receita retida" (fundo #fef2f2, icone AlertTriangle, texto 13px)

### Secao 2: Grafico Radar (card branco, centralizado, width ~500px)
Titulo: "Comparativo de Clusters"
- Recharts RadarChart com 5 eixos:
  - LTV, Conversao, Retencao, Ticket Medio, Volume de Leads
- 3 poligonos sobrepostos:
  - Mineradoras Mid-Market: verde #10B981, valores altos em LTV/Conversao/Retencao
  - Construtoras Regionais: azul #3b82f6, valores medios
  - Anti-ICP: vermelho #ef4444, valores baixos exceto Volume
- Legenda abaixo com nomes e cores
- Dados normalizados 0-100:
  - Cluster 1: LTV 95, Conversao 85, Retencao 92, Ticket 88, Volume 35
  - Cluster 2: LTV 55, Conversao 55, Retencao 60, Ticket 50, Volume 75
  - Cluster 3: LTV 15, Conversao 20, Retencao 12, Ticket 10, Volume 50

### Secao 3: Insight
Card com borda esquerda gradiente azul-verde, fundo #f0fdf4:
- Icone Lightbulb
- Texto: "O ICP Cluster 1 (Mineradoras Mid-Market) tem **3.2x mais LTV** que o Anti-ICP. Realocar 30% do budget de Google Ads para LinkedIn (que gera mais leads deste perfil) pode aumentar o ROI em **45%**."
- Badge: "Dados do Retain Sense: clientes do Cluster 1 tem Health Score medio de 84"

---

## Pagina 2: Funil & Gargalos (/obtain/funnel)

**Header:** "Analise de Funil e Gargalos" + badge "Obtain Sense" verde. Subtitulo: "Identifique onde leads de alto valor estao travando"

### Secao 1: Funil visual (full width, card branco)
Titulo: "Funil de Conversao"

Representacao com 5 blocos horizontais decrescentes em largura:
- Cada bloco: retangulo arredondado, cor verde #10B981 com opacity crescente
- Dentro: nome (bold branco), quantidade, porcentagem
- Entre blocos: indicador drop-off (seta para baixo + "X% perdidos" em vermelho)

```
|=============== Prospeccao: 287 (100%) ===============|
                    ↓ 31% perdidos
      |========= Qualificacao: 198 (69%) =========|
                    ↓ 55% perdidos
         |====== Demo: 89 (31%) ======|
              ↓ 49% perdidos ⚠️ GARGALO
            |=== Proposta: 45 (16%) ===|
                    ↓ 73% perdidos
               |= Fechado: 12 (4%) =|
```

O gargalo (Demo → Proposta) deve ter:
- Borda vermelha no indicador de drop-off
- Icone AlertTriangle
- Texto em vermelho: "18 dias — gargalo identificado"

### Secao 2: Metricas por Estagio (tabela)

| Estagio | Leads | Tempo Medio | Drop-off | Hot Travados | Receita Presa |
|---------|-------|-------------|----------|-------------|---------------|
| Prospeccao | 287 | — | — | 12 | R$ 14.4M |
| Qualificacao | 198 | 5 dias | 31% | 8 | R$ 9.6M |
| Demo | 89 | 8 dias | 55% | 6 | R$ 7.2M |
| **Proposta** | **45** | **18 dias** ⚠️ | **49%** | **4** | **R$ 4.8M** |
| Fechado | 12 | 12 dias | 73% | — | — |

Linha "Proposta": fundo rosado #fef2f2, icone AlertTriangle na coluna Tempo Medio

### Secao 3: Alertas (3 cards)
1. Icone AlertTriangle vermelho: "23 leads Hot parados em Proposta ha mais de 7 dias — **R$ 12.4M** em LTV em risco"
2. Icone TrendingUp verde: "Leads de **Indicacao** passam por Demo → Proposta **2.3x mais rapido** que Outbound"
3. Icone Clock amarelo: "34 leads Cold em Prospeccao ha mais de 30 dias: considerar desqualificar"

---

## Pagina 3: CAC vs LTV (/obtain/cac-ltv)

**Header:** "Eficiencia de Aquisicao: CAC vs LTV" + badge "Obtain Sense" verde. Subtitulo: "Performance financeira das campanhas de aquisicao"

### Secao 1: Scatter Plot grande (full width, height 420px)
Mesmo scatter do dashboard mas maior e com mais detalhes:
- Recharts ScatterChart
- Eixo X: "CAC (R$)" range 0-15000, formatado com R$
- Eixo Y: "LTV Previsto (R$)" range 0-1000000, formatado com R$
- 4 quadrantes com fundo colorido suave e labels:
  - Q1 superior esquerdo: fundo #f0fdf4, label "ESCALAR" verde
  - Q2 superior direito: fundo #eff6ff, label "AVALIAR" azul
  - Q3 inferior esquerdo: fundo #fffbeb, label "ATENCAO" amarelo
  - Q4 inferior direito: fundo #fef2f2, label "INTERROMPER" vermelho
- Linhas de referencia tracejadas: CAC=R$6.000 (vertical), LTV=R$400.000 (horizontal)
- 5 pontos com tamanho proporcional a leads:
  - Indicacao (verde, grande): CAC R$2.100, LTV R$890k, 156 leads
  - Feira (azul, medio): CAC R$8.500, LTV R$720k, 87 leads
  - LinkedIn (azul, grande): CAC R$5.200, LTV R$540k, 134 leads
  - Google Ads (amarelo, muito grande): CAC R$3.800, LTV R$180k, 245 leads
  - Outbound (vermelho, grande): CAC R$12.000, LTV R$150k, 178 leads

### Secao 2: Tabela de Campanhas

| Campanha | Canal | Leads | CAC | LTV Medio | ROI Projetado | Status |
|----------|-------|-------|-----|-----------|---------------|--------|
| Indicacao de clientes | Referral | 156 | R$ 2.100 | R$ 890k | 423x | "Escalar" badge verde |
| Feira AgroBrasilia 2025 | Evento | 87 | R$ 8.500 | R$ 720k | 84x | "Bom" badge azul |
| LinkedIn Ads - Mineracao | Paid Social | 134 | R$ 5.200 | R$ 540k | 103x | "Bom" badge azul |
| Google Ads - Equipamentos | Paid Search | 245 | R$ 3.800 | R$ 180k | 47x | "Atencao" badge amarelo |
| Prospeccao Outbound | Outbound | 178 | R$ 12.000 | R$ 150k | 12x | "Interromper" badge vermelho |

### Secao 3: Alerta de Retroalimentacao
Card com borda esquerda 4px gradiente azul-verde, fundo #f0fdf4:
- Badge: "Dados do Retain Sense" (fundo #293b83, branco)
- Icone RefreshCcw (loop)
- Texto: "Campanha **Outbound** gera leads com churn medio de **4 meses**. CAC de R$ 12.000 nao se paga. Clientes dessa origem tem Health Score medio de **32** (critico)."
- Texto bold: "Sugestao: realocar 80% do budget de Outbound para Indicacao (+150% de ROI estimado)"
