# Prompt 6/8 — Obtain Sense: Dashboard Executivo + Lead Scoring

Crie 2 paginas do modulo Obtain Sense: Dashboard Executivo e Lead Scoring. O Obtain Sense e o modulo de inteligencia de aquisicao, focado em otimizar quem buscar como cliente, como qualificar leads e onde investir em marketing.

## Design System resumido
- Fonte: Inter. **Cor de acento deste modulo: verde esmeralda #10B981** e verde claro #34D399. Fundo #f8fafc, cards brancos shadow-sm rounded-xl. Recharts. shadcn/ui. Lucide. PT-BR.

---

## Pagina 1: Dashboard Executivo Obtain (/obtain)

**Header:** "Dashboard Executivo" + badge "Obtain Sense" (fundo #10B981, texto branco). Subtitulo: "Inteligencia de aquisicao e performance comercial"

### Secao 1: KPIs (5 cards em grid, gap-4)
Mesmo componente MetricCard, mas icones com circulo de fundo verde claro:

| # | Icone | Label | Valor | Variacao | Cor |
|---|-------|-------|-------|----------|-----|
| 1 | DollarSign | CAC Atual | R$ 5.200 | -8% | verde (CAC caiu) |
| 2 | TrendingUp | LTV Medio Previsto | R$ 540K | +5% | verde |
| 3 | Target | Taxa Conversao Funil | 24% | +2.1% | verde |
| 4 | Clock | Tempo Medio Aquisicao | 43 dias | -3 dias | verde |
| 5 | Wallet | Receita Potencial no Funil | R$ 38.2M | +15% | verde |

### Secao 2: Graficos (grid 2 colunas)

**Esquerda — Matriz CAC x LTV (Scatter Chart)**
Card com titulo "Eficiencia de Canais: CAC x LTV":
- Recharts ScatterChart
- Eixo X: CAC (R$) — range 0 a 15.000
- Eixo Y: LTV (R$) — range 0 a 1.000.000
- Linhas de referencia tracejadas formando 4 quadrantes:
  - Linha vertical em CAC = R$ 6.000
  - Linha horizontal em LTV = R$ 400.000
- Labels nos quadrantes (texto 11px, cinza, semi-transparente):
  - Superior esquerdo: "ESCALAR" (fundo verde muito claro)
  - Superior direito: "AVALIAR" (fundo azul muito claro)
  - Inferior esquerdo: "ATENCAO" (fundo amarelo muito claro)
  - Inferior direito: "INTERROMPER" (fundo vermelho muito claro)
- 5 pontos (circulos):
  - Indicacao: x=2100, y=890000, size=156, cor=#22c55e (verde)
  - Feira AgroBrasilia: x=8500, y=720000, size=87, cor=#3b82f6 (azul)
  - LinkedIn Ads: x=5200, y=540000, size=134, cor=#3b82f6 (azul)
  - Google Ads: x=3800, y=180000, size=245, cor=#f59e0b (amarelo)
  - Outbound: x=12000, y=150000, size=178, cor=#ef4444 (vermelho)
- O tamanho (size) do circulo e proporcional ao numero de leads
- Tooltip ao hover: nome da campanha + CAC + LTV + leads

**Direita — Funil de Conversao (custom)**
Card com titulo "Funil de Vendas":
- Representacao visual do funil (pode ser barras horizontais com largura decrescente):
  - Prospeccao: 287 leads — barra mais larga — cor #10B981 opacity 0.3
  - Qualificacao: 198 leads — barra menor — cor #10B981 opacity 0.5
  - Demo: 89 leads — menor — cor #10B981 opacity 0.7
  - Proposta: 45 leads — menor — cor #10B981 opacity 0.85 — BORDA VERMELHA (gargalo)
  - Fechado: 12 leads — menor — cor #10B981 opacity 1.0
- Entre cada barra: texto "↓ -31%" (drop-off rate) em vermelho 11px
- A transicao Demo→Proposta deve ter destaque: borda vermelha #ef4444, icone AlertTriangle, tooltip "18 dias — gargalo identificado"
- Cada barra mostra: nome da etapa + quantidade de leads + porcentagem do total

### Secao 3: Graficos secundarios (grid 2 colunas)

**Esquerda — Evolucao Qualidade do Funil (Stacked Area Chart)**
Card com titulo "Qualidade dos Leads por Mes":
- 3 areas empilhadas:
  - Hot (#10B981): [15, 18, 20, 24, 28, 34]
  - Warm (#f59e0b): [85, 90, 95, 100, 105, 110]
  - Cold (#94a3b8): [120, 110, 105, 98, 90, 85]
- Eixo X: Out/25 a Mar/26
- Mostra tendencia: mais Hot, menos Cold ao longo do tempo

**Direita — Distribuicao por ICP (Donut Chart)**
Card com titulo "Leads por Cluster ICP":
- 3 segmentos:
  - "Mineradoras Mid-Market" (ICP Ideal): 42% — #10B981
  - "Construtoras Regionais": 35% — #3b82f6
  - "Anti-ICP: Micro-empresas": 23% — #ef4444
- Centro: "287" + "leads ativos"
- Legenda abaixo

---

## Pagina 2: Lead Scoring (/obtain/leads)

**Header:** "Lead Scoring Preditivo" + badge "Obtain Sense" verde. Subtitulo: "Leads ordenados por probabilidade de conversao"

### Barra de filtros
- Busca: "Buscar lead por nome ou empresa..."
- Select: Tier (Todos, Hot, Warm, Cold, Desqualificado)
- Select: Campanha (Indicacao, Feira, LinkedIn, Google Ads, Outbound)
- Select: ICP Cluster (Mineradoras Mid-Market, Construtoras Regionais, Anti-ICP)
- Slider: Score minimo (0-100, default 0)
- Botao: "Exportar CSV"

### Tabela de leads

| Coluna | Conteudo | Estilo |
|--------|----------|--------|
| Lead | Nome bold + empresa abaixo cinza | 22% |
| Score | Numero grande com cor: >=80 verde, 50-79 amarelo, 30-49 cinza, <30 vermelho | 8% |
| Tier | Badge: Hot (bg #10B981 branco), Warm (bg #f59e0b), Cold (bg #94a3b8), Disqualified (bg #ef4444) | 10% |
| LTV Previsto | R$ formatado | 12% |
| ICP Cluster | Texto curto | 14% |
| Campanha | Texto | 10% |
| Status | Badge colorido | 10% |
| Ultima Acao | Data relativa | 8% |
| | Botao "Detalhes" | 6% |

Linhas Hot: fundo #ecfdf5. Default: score desc.

**15 linhas:**
```
Rafael Mendes | Mineradora Cristalina LTDA | 94 | Hot | R$ 1.2M | Mineradoras Mid-Market | Indicacao | Proposta
Lucas Ferreira | Mineracao Planalto Central | 91 | Hot | R$ 1.1M | Mineradoras Mid-Market | Indicacao | Demo
Luciana Torres | Terraplenagem Nacional SA | 88 | Hot | R$ 890k | Mineradoras Mid-Market | Feira | Demo
Carlos Andrade | Construtora Progresso GO | 85 | Hot | R$ 780k | Construtoras Regionais | LinkedIn | Qualificando
Marina Silva | AgroPecus Maquinas LTDA | 82 | Hot | R$ 650k | Construtoras Regionais | Indicacao | Contactado
Pedro Henrique | Mineracao Araguaia | 78 | Warm | R$ 920k | Mineradoras Mid-Market | Feira | Demo
Amanda Nunes | Construtora Boa Vista SA | 76 | Warm | R$ 580k | Construtoras Regionais | LinkedIn | Proposta
Fernanda Lopes | Pavimentadora Centro-Oeste | 74 | Warm | R$ 560k | Construtoras Regionais | LinkedIn | Qualificando
Beatriz Gomes | AgriTech Cerrado LTDA | 72 | Warm | R$ 420k | Construtoras Regionais | Feira | Qualificando
Jorge Almeida | Britagem Serra Azul | 71 | Warm | R$ 480k | Construtoras Regionais | Google Ads | Novo
Roberto Dias | Siderurgica Vale Araguaia | 65 | Warm | R$ 720k | Mineradoras Mid-Market | Feira | Qualificando
Diego Martins | Pedreira Regional DF | 63 | Warm | R$ 380k | Construtoras Regionais | LinkedIn | Novo
Marcos Vinicius | Ceramica Tocantins | 45 | Cold | R$ 120k | Anti-ICP | Google Ads | Novo
Juliana Moreira | Borracharia Industrial ME | 38 | Cold | R$ 45k | Anti-ICP | Outbound | Novo
Felipe Santos | Serralheria Tocantins ME | 28 | Disqualified | R$ 18k | Anti-ICP | Outbound | Novo
```

### Drawer lateral (Sheet, 520px, pela direita)

Mostrar aberto com dados de **Rafael Mendes — Mineradora Cristalina LTDA**.

**Cabecalho:**
- "Rafael Mendes" (22px Bold) + badge "Hot" verde
- "Mineradora Cristalina LTDA" (14px cinza)

**Mini-cards (3 em linha):**
- Score: **94**/100 (fundo #ecfdf5, barra verde, gauge circular se possivel)
- LTV Previsto: **R$ 1.2M** (fundo #ecfdf5)
- Prob. Conversao: **87%** (fundo #ecfdf5, verde)

**SHAP Waterfall (VERDE)**
Titulo: "Fatores que Influenciam o Score"
Mesmo componente waterfall do Retain, mas com cores invertidas:
- Barras VERDES: fatores que AUMENTAM o score (bom para conversao)
- Barras VERMELHAS: fatores que DIMINUEM o score

Fatores:
1. "Setor alinhado ao ICP Cluster 1" — barra VERDE — **+22 pts**
2. "Empresa com +800 funcionarios" — barra VERDE — **+15 pts**
3. "Veio de indicacao de cliente ativo" — barra VERDE — **+12 pts**
4. "Ja agendou demo" — barra VERDE — **+10 pts**
5. "Regiao Centro-Oeste (GO)" — barra VERDE — **+8 pts**
6. "Tempo sem contato (5 dias)" — barra VERMELHA — **-4 pts**

**Oferta Recomendada:**
Card borda esquerda 4px #10B981, fundo #ecfdf5:
- Titulo: "Oferta Recomendada" + badge "72% conversao neste perfil"
- Texto: "Diagnostico Executivo de Frota — R$ 35.000 a R$ 55.000"
- Subtexto: "Clientes do ICP Cluster 1 que recebem esta oferta convertem 72% mais"
- Botao: "Registrar acao" (verde #10B981)

**ICP Match:**
- "Mineradoras Mid-Market Centro-Oeste" + barra de similaridade 94% (verde)

**Info do lead:** empresa, setor (Mineracao), porte (Grande, +800 func.), Goiania/GO, campanha (Indicacao), data entrada (12/01/2026), responsavel (Caio Ferreira)
