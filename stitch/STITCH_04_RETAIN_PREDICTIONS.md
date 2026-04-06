# Prompt 4/8 — Retain Sense: Predicoes de Churn (/retain/predictions)

Crie a pagina de predicoes de churn do modulo Retain Sense. Esta pagina tem uma tabela de clientes ordenada por probabilidade de churn e um drawer lateral com detalhes incluindo um grafico SHAP Waterfall que explica os fatores de cada predicao. O SHAP Waterfall e o componente mais importante e diferenciado da aplicacao.

## Design System resumido
- Fonte: Inter. Cor de acento: azul #293b83. Fundo #f8fafc, cards brancos shadow-sm rounded-xl. Recharts. shadcn/ui. Lucide. PT-BR.

## Header
- Titulo: "Predicoes de Churn" + badge "Retain Sense" (azul)
- Subtitulo: "Empresas ordenadas por probabilidade de cancelamento"

## Barra de filtros (dentro de card branco, horizontal, gap-3)
- Input com icone Search: placeholder "Buscar por nome ou codigo..." (width 280px)
- Select "Nivel de Risco": opcoes Todos, Baixo, Medio, Alto, Critico
- Select "Segmento": opcoes Todos, Mineracao, Construcao Civil, Agropecuaria, Industrial
- Select "Status": opcoes Todos, Ativo, Em Risco, Churned
- Botao outline a direita: icone Download + "Exportar CSV"

## Tabela de clientes

Usar shadcn/ui Table. Colunas:

| Coluna | Conteudo | Estilo |
|--------|----------|--------|
| Empresa | Nome bold 14px + codigo abaixo cinza 12px | width 22% |
| Segmento | Badge colorido (Mineracao=#293b83, Construcao=#3b5998, Agro=#64b783, Industrial=#67b4b0) | width 12% |
| Valor do Contrato | R$ com pontos de milhar, 14px | width 12% |
| Health Score | Barra de progresso (Progress do shadcn) colorida + numero ao lado. Vermelho <40, Amarelo 40-60, Verde >60. Barra width 80px | width 14% |
| Prob. Churn | Porcentagem bold. Vermelho se >75%, Laranja se >50%, Amarelo se >25%, Verde se <25% | width 10% |
| Risco | Badge: Critico (bg #fef2f2 texto #ef4444), Alto (bg #fff7ed texto #f97316), Medio (bg #fffbeb texto #f59e0b), Baixo (bg #f0fdf4 texto #22c55e) | width 10% |
| Tendencia | Seta TrendingUp vermelha ou TrendingDown verde (16px) | width 6% |
| Acoes | Botao "Detalhes" outline pequeno (size sm) | width 10% |

**Linhas com destaque:**
- Risco Critico: fundo da linha #fef2f2 (rosa muito claro)
- Risco Alto: fundo da linha #fff7ed (laranja muito claro)

**Paginacao:** Abaixo da tabela, "Mostrando 1-20 de 482" + botoes Anterior/Proximo

**20 linhas de dados (usar exatamente estes):**
```
Irrigacao Cerrado LTDA | Agropecuaria | R$ 43.200 | 15 | 91% | Critico | ↑
Mineradora Vale Norte Ltda | Mineracao | R$ 156.800 | 18 | 89% | Critico | ↑
Terraplenagem Tocantins | Construcao Civil | R$ 45.200 | 22 | 85% | Critico | ↑
Construtora Horizonte SA | Construcao Civil | R$ 89.400 | 32 | 78% | Alto | ↑
Silos Araguaia LTDA | Agropecuaria | R$ 34.600 | 29 | 76% | Alto | ↑
AgroPlan Mecanizacao | Agropecuaria | R$ 67.200 | 38 | 72% | Alto | ↓
LogPetro Transportes | Industrial | R$ 56.700 | 35 | 68% | Alto | ↑
Pavimentacao Nacional SA | Construcao Civil | R$ 78.400 | 52 | 54% | Medio | ↓
Pedreira Goias Central | Mineracao | R$ 134.500 | 55 | 48% | Medio | ↓
Mineracao Serra Dourada | Mineracao | R$ 223.100 | 58 | 46% | Medio | ↑
Industrial Minas Gerais | Industrial | R$ 198.400 | 61 | 44% | Medio | ↓
Mineracao Rio Claro | Mineracao | R$ 178.900 | 64 | 42% | Medio | ↑
Construtora Alianca GO | Construcao Civil | R$ 95.600 | 73 | 28% | Baixo | ↓
Concreteira Planalto | Construcao Civil | R$ 112.300 | 76 | 22% | Baixo | ↓
Usina Solar Goias | Industrial | R$ 89.100 | 79 | 18% | Baixo | ↓
Fazenda Sao Jorge Energia | Agropecuaria | R$ 78.900 | 82 | 15% | Baixo | ↓
Construtora Capital DF | Construcao Civil | R$ 167.800 | 85 | 12% | Baixo | ↓
BrasilAgro Maquinas | Agropecuaria | R$ 145.600 | 88 | 10% | Baixo | ↓
Cimento Norte Tocantins | Industrial | R$ 201.300 | 91 | 7% | Baixo | ↓
Siderurgica Centro-Oeste | Industrial | R$ 312.400 | 94 | 4% | Baixo | ↓
```

## Drawer lateral (Sheet do shadcn, abre pela direita)

Abre ao clicar em "Detalhes" de qualquer cliente. Width 520px. Scroll interno. Overlay escuro.

Mostrar o drawer ja aberto com dados da **Mineradora Vale Norte Ltda**.

### Cabecalho do drawer
- Botao X para fechar (canto superior direito)
- Nome: "Mineradora Vale Norte Ltda" (22px Bold)
- Linha abaixo: badge "Critico" vermelho + "COD-001" cinza + badge "Mineracao" azul

### Mini-cards (3 em linha, gap-3)
Cards pequenos (fundo colorido suave):
- Health Score: **18**/100 (fundo #fef2f2, barra vermelha, numero vermelho grande)
- Prob. Churn: **89%** (fundo #fef2f2, numero vermelho 24px Bold)
- Valor Contrato: **R$ 156.800**/mes (fundo #f0f9ff, numero azul)

### SHAP Waterfall Chart (CRITICO — componente principal)

Titulo da secao: "Fatores que Influenciam a Predicao" (16px SemiBold)

Subtitulo: "Como cada fator contribui para a probabilidade de churn" (13px cinza)

O grafico mostra barras horizontais, uma por fator, com valores de contribuicao:

**Layout do waterfall:**
- Linha de referencia a esquerda: "Base: 15%" (texto cinza, linha tracejada vertical)
- 6 linhas de fatores, cada uma com:
  - Texto do fator a esquerda (14px, largura fixa ~250px)
  - Barra horizontal proporcional ao impacto
  - Valor da contribuicao a direita da barra (ex: "+28%")
- Linha de resultado no final: "Predicao: 89%" (texto bold, linha tracejada)

**Fatores (de cima para baixo):**
1. "Atraso no pagamento (22 dias)" — barra VERMELHA — **+28%**
2. "Contrato vence em 15 dias" — barra VERMELHA — **+22%**
3. "Baixa utilizacao equipamentos (35%)" — barra VERMELHA — **+18%**
4. "Alto vol. chamados tecnicos (8)" — barra VERMELHA — **+15%**
5. "Parceria longa (36 meses)" — barra VERDE — **-11%**
6. "Receita alta (R$ 156.800)" — barra VERDE — **-8%**

**Cores das barras:**
- VERMELHA (#ef4444): fatores que AUMENTAM o risco de churn
- VERDE (#22c55e): fatores PROTETORES que diminuem o risco

**Cada barra:** height 32px, rounded ends, com transicao suave de largura

**Implementacao sugerida:** Usar Recharts BarChart customizado com layout vertical e barras bidirecionais, ou SVG customizado. O importante e que seja claro, bonito e legivel por um executivo nao-tecnico.

### Acao Recomendada
Card com borda esquerda 4px #293b83, fundo #f0f4ff:
- Titulo: "Acao Recomendada" (14px SemiBold)
- Texto: "Agendar reuniao de renovacao com desconto de 5-10% para contrato de 12 meses. Priorizar resolucao dos 8 chamados tecnicos pendentes antes da reuniao." (14px)
- Botao: "Criar acao de retencao" (primario azul, size sm)

### Informacoes do cliente
Grid 2 colunas (gap-y-3):
- Cidade/UF: Goiania/GO
- Tempo de parceria: 36 meses
- Utilizacao equipamentos: 35%
- NPS: 3 (com icone vermelho — detrator)
- Chamados tecnicos: 8 abertos
- Servicos contratados: 4
- Ultimo contato: 15/03/2026
- Contrato: Anual (vence 15/04/2026)

Cada item: label cinza 12px em cima, valor preto 14px embaixo.
