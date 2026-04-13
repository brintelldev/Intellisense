# IntelliSense — Como a Solução Funciona

## O que é o IntelliSense?

O IntelliSense é uma plataforma de **Customer Lifecycle Intelligence** que conecta dois momentos críticos do ciclo de vida do cliente: a **aquisição** (Obtain Sense) e a **retenção** (Retain Sense). Diferente de ferramentas que tratam esses dois problemas de forma isolada, o IntelliSense cria um loop de retroalimentação onde os padrões de churn dos clientes atuais refinam automaticamente o perfil ideal de novos clientes — e vice-versa.

---

## Módulos

### Retain Sense — Retenção de Clientes

Monitora a saúde da base de clientes existente, prevê riscos de churn antes que aconteçam e recomenda ações específicas para reter cada cliente.

**O que o gestor vê:**
- **Dashboard executivo**: Churn rate, MRR, receita em risco, health score médio, distribuição de risco
- **Predições de churn**: Lista de clientes com probabilidade de churn, nível de risco e explicação dos fatores
- **Causas raiz**: Quais fatores estão mais causando churn na base (atraso de pagamento, baixo uso, insatisfação, etc.)
- **Alertas acionáveis**: Notificações automáticas quando um cliente cruza thresholds de risco, com ação sugerida
- **Tendências**: Evolução dos KPIs ao longo do tempo baseada em uploads periódicos
- **Simulador de ROI**: Projeção do impacto financeiro de ações de retenção

### Obtain Sense — Aquisição de Clientes

Analisa e prioriza leads, mapeia o perfil ideal de cliente (ICP), analisa o funil de vendas e otimiza a relação CAC vs LTV.

**O que o gestor vê:**
- **Lead Scoring**: Cada lead recebe uma nota de 0-100 com classificação (hot, warm, cold, disqualified) e explicação do porquê
- **Perfil Ideal (ICP)**: Clusters de clientes ideais, bons e anti-ICP, baseados em dados reais da base
- **Funil de vendas**: Análise por etapa com identificação de gargalos, leads parados e receita em risco
- **CAC vs LTV**: Matriz de eficiência por campanha/canal mostrando onde investir e onde cortar
- **Simulador de ROI**: Projeção de retorno sobre investimento em aquisição

---

## Como os Dados Entram na Plataforma

### Upload de CSV com Mapeamento Inteligente

O IntelliSense se adapta ao formato de dados de cada cliente. O processo funciona em 4 etapas:

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌──────────────┐
│  1. Upload   │ →  │  2. Mapeamento   │ →  │ 3. Validação │ →  │ 4. Resultado │
│  do arquivo  │    │  inteligente     │    │ e confirmação│    │  detalhado   │
└──────────────┘    └──────────────────┘    └──────────────┘    └──────────────┘
```

**Etapa 1 — Upload**: O cliente exporta um CSV do ERP, CRM ou planilha que já utiliza. Não precisa seguir um formato específico.

**Etapa 2 — Mapeamento Inteligente**: O sistema analisa automaticamente os nomes das colunas e uma amostra dos dados para sugerir o mapeamento:

| Coluna do CSV do cliente | Sugestão do IntelliSense | Confiança |
|--------------------------|--------------------------|-----------|
| `faturamento_mensal`     | Receita Mensal           | Alta      |
| `nota_nps`               | Satisfação               | Alta      |
| `dias_sem_compra`        | Recência (dias)          | Alta      |
| `qtd_chamados`           | Volume de Suporte        | Média     |
| `tipo_contrato`          | *(coluna extra)*         | —         |

O gestor pode aceitar as sugestões, ajustar manualmente, e salvar o mapeamento como template para próximos uploads.

**Etapa 3 — Validação**: O sistema valida cada linha, mostra preview dos dados mapeados, e permite confirmar antes de processar.

**Etapa 4 — Resultado**: Relatório detalhado: quantos registros foram criados, atualizados, e quantos tiveram erros (com detalhes).

### Colunas Extras e Dimensões Customizadas

Colunas do CSV que não se encaixam nas 9 dimensões universais são preservadas e podem:
- Servir como **filtros de segmentação** (ex: ver churn rate só da "região Sul")
- Ser promovidas a **dimensões customizadas** pelo admin, com peso configurável no cálculo dos scores

### Uploads Incrementais

O sistema identifica registros já existentes (pelo código do cliente ou email do lead) e faz **atualização** em vez de duplicar. Isso permite uploads periódicos (semanal, mensal) para acompanhar a evolução.

---

## Como a Inteligência é Gerada

### Pipeline de Processamento

Após cada upload, o sistema executa automaticamente:

```
Upload CSV
    │
    ▼
Parse + Mapeamento + Validação
    │
    ▼
Upsert no banco (criar ou atualizar registros)
    │
    ├──▶ Cálculo de Health Score (9 dimensões + custom)
    │        │
    │        ▼
    │    Probabilidade de Churn (com multiplicadores de gatilho)
    │        │
    │        ▼
    │    Classificação de Risco (low / medium / high / critical)
    │        │
    │        ▼
    │    Geração de Explicações (SHAP values)
    │        │
    │        ▼
    │    Ação Recomendada (baseada no risco + fator dominante)
    │
    ├──▶ Geração de Alertas (thresholds cruzados)
    │
    ├──▶ Snapshot de Analytics (KPIs do dia para tendências)
    │
    └──▶ Atualização de Causas Raiz (agregação dos fatores)
```

### Health Score — Como é Calculado

O Health Score (0-100) é uma combinação ponderada de 9 dimensões universais:

| Dimensão | Peso | O que mede | Escala |
|----------|------|------------|--------|
| Satisfação | 20% | NPS, CSAT ou nota de satisfação | Maior = melhor |
| Regularidade de Pagamento | 18% | Dias de atraso médio | Menor = melhor |
| Intensidade de Uso | 18% | Frequência e profundidade de uso do produto/serviço | Maior = melhor |
| Frequência de Interação | 12% | Contatos, reuniões, engajamento | Maior = melhor |
| Dias p/ Fim do Contrato | 10% | Tempo restante até renovação | Maior = melhor |
| Volume de Suporte | 10% | Chamados, reclamações | Menor = melhor |
| Recência | 7% | Dias desde última interação/compra | Menor = melhor |
| Tempo de Relacionamento | 5% | Tenure — há quanto tempo é cliente | Maior = melhor (com retornos decrescentes) |

**Normalização inteligente**: O sistema usa curvas sigmoid em vez de escala linear. Isso significa que a diferença entre 0 e 5 dias de atraso no pagamento é tratada de forma muito diferente da diferença entre 25 e 30 dias — capturando a urgência real de cada situação.

**Pesos configuráveis**: O administrador pode ajustar os pesos de cada dimensão para refletir a realidade do seu negócio. Uma empresa de aluguel de equipamentos pode dar mais peso para "intensidade de uso", enquanto um SaaS pode priorizar "recência".

### Churn Probability — Além da Simples Inversão

A probabilidade de churn não é simplesmente `100 - healthScore`. O sistema aplica **multiplicadores de gatilho** que simulam como fatores de risco se acumulam:

- Contrato expirando em menos de 30 dias → risco amplificado em 25%
- Atraso de pagamento significativo (>15 dias) → risco amplificado em 15%
- Satisfação muito baixa (<25) → risco amplificado em 20%
- Uso quase zero (<20) → risco amplificado em 10%

Quando múltiplos sinais negativos coexistem, eles se **multiplicam** — criando um comportamento similar ao de modelos de machine learning reais.

### Explainability — O Diferencial SHAP

Para cada cliente ou lead, o IntelliSense mostra **por que** aquele score foi gerado, não apenas o número. O gráfico waterfall (cascata) mostra:

```
Health Score: 38 / 100

Satisfação (NPS: 22)          ████████████▎  -18.4  ↓ Puxando para baixo
Regularidade Pgto (32 dias)   ████████▌      -12.1  ↓ Puxando para baixo
Uso do Produto (15%)          ██████▎        -9.8   ↓ Puxando para baixo
Tempo de Contrato (340 dias)  ███▋           +5.2   ↑ Protegendo
Interação (freq. média)       ██▏            +3.1   ↑ Protegendo
```

Isso permite que o gestor entenda exatamente **o que está errado** e **onde agir**, em vez de receber apenas um número vermelho.

Para modelos lineares ponderados, essa contribuição marginal é matematicamente equivalente ao SHAP value — não é uma aproximação, é o cálculo correto.

### Alertas Acionáveis

O sistema gera alertas automaticamente quando:

| Gatilho | Severidade | Exemplo de Alerta |
|---------|------------|-------------------|
| Health Score < 25 | Crítica | "URGENTE: Cliente Minera Norte com saúde crítica (score 18). Agendar visita imediata." |
| Health Score < 40 | Alta | "Cliente Construtora ABC com saúde em declínio (score 35). Principais fatores: pagamento e uso." |
| Churn Probability > 70% | Alta | "Risco elevado de churn para Agro Sul (73%). Ação: renegociar contrato." |
| Contrato expira em < 30 dias | Alta | "Contrato de Industrial Centro expira em 22 dias. Status: risco médio." |
| Health Score caiu > 15 pts | Média | "Saúde de Transportes Oeste caiu 18 pontos desde o último upload." |

Cada alerta vem com uma **ação recomendada** contextualizada pelo tipo de risco e pelo fator dominante.

---

## Feedback Loop: Retain ↔ Obtain

O grande diferencial do IntelliSense é a conexão entre retenção e aquisição:

```
                    ┌─────────────────────────────────────┐
                    │         FEEDBACK LOOP                │
                    │                                      │
   ┌────────┐      │  Padrões de churn informam           │      ┌────────┐
   │ RETAIN │──────┤  quem NÃO adquirir (anti-ICP)        ├─────▶│ OBTAIN │
   │ SENSE  │      │                                      │      │ SENSE  │
   └────────┘      │  Perfil dos melhores clientes        │      └────────┘
       ▲           │  refina o ICP ideal                   │          │
       │           └─────────────────────────────────────┘          │
       │                                                             │
       └─────────── Novos clientes convertidos ◀─────────────────────┘
```

**Como funciona na prática:**

1. O módulo Retain identifica que clientes do segmento "micro-empresas" têm churn 3x maior que a média
2. Essa informação alimenta o ICP do Obtain, classificando "micro-empresas" como **anti-ICP**
3. Leads desse perfil recebem score mais baixo automaticamente, priorizando leads com perfil de sucesso
4. Resultado: o time comercial foca em prospects com maior probabilidade de se tornarem clientes duradouros

**Insight visível na plataforma**: "Clientes vindos por indicação têm 62% menos churn que clientes de campanha paga" — permitindo realocar budget de aquisição.

---

## O que o Administrador Pode Configurar

### Pesos de Scoring
Ajustar o peso de cada dimensão no cálculo de Health Score e Lead Score via interface visual (sliders). Após salvar, todos os scores são recalculados automaticamente.

### Dimensões Customizadas
Criar dimensões específicas do negócio além das 9 universais. Exemplo:
- "Quantidade de Equipamentos Alugados" (peso 8%, maior = melhor)
- "Distância da Filial" (peso 3%, menor = melhor)

### Thresholds de Alerta
Configurar quando alertas são disparados (ex: mudar o limite de health score crítico de 25 para 30).

### Templates de Mapeamento
Salvar e reutilizar mapeamentos de colunas CSV para uploads recorrentes.

### Labels por Setor
Personalizar terminologia: "Cliente" pode ser "Empresa", "Conta" ou "Parceiro". "Receita" pode ser "MRR", "Faturamento" ou "Mensalidade".

---

## Visão Técnica da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Dashboards│  │ Upload   │  │ Predições│  │ Config  │ │
│  │ + Charts  │  │ + Mapper │  │ + SHAP   │  │ + Admin │ │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘  └────┬────┘ │
│        └──────────┬────┴────────────┬┴────────────┘      │
│                   │  React Query    │                     │
└───────────────────┼─────────────────┼─────────────────────┘
                    │    REST API     │
┌───────────────────┼─────────────────┼─────────────────────┐
│                   │  EXPRESS.JS     │          BACKEND     │
│  ┌────────────────▼─────────────────▼──────────────────┐  │
│  │              API Routes (multi-tenant)               │  │
│  └────────────────┬─────────────────┬──────────────────┘  │
│                   │                 │                      │
│  ┌────────────────▼──┐  ┌──────────▼───────────────────┐  │
│  │  Intelligence     │  │  Column Mapper Engine         │  │
│  │  Engine           │  │  (auto-detecção + sinônimos)  │  │
│  │  ├ Health Score   │  └──────────────────────────────┘  │
│  │  ├ Churn Prob     │                                    │
│  │  ├ Lead Score     │                                    │
│  │  ├ SHAP Values    │  ┌──────────────────────────────┐  │
│  │  ├ Alerts         │  │  ICP Clustering Engine        │  │
│  │  └ Actions        │  │  (rule-based → ML-ready)      │  │
│  └────────┬──────────┘  └──────────┬───────────────────┘  │
│           │                        │                      │
│  ┌────────▼────────────────────────▼───────────────────┐  │
│  │              PostgreSQL (Drizzle ORM)                │  │
│  │  customers, predictions, analytics, alerts, leads,   │  │
│  │  scores, icp_clusters, campaigns, uploads, configs   │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### Preparado para ML

A arquitetura usa o **Strategy Pattern** para permitir migração transparente de heurísticas para machine learning:

```
Hoje (heurísticas):
  scoringConfig = { mode: "heuristic", weights: {...}, thresholds: {...} }

Amanhã (ML):
  scoringConfig = { mode: "ml", modelId: "xgboost-v2", endpoint: "/ml/predict" }
```

O FastAPI ML service já está estruturado (stubbed) para receber esse tráfego quando houver volume de dados suficiente para treino.

---

## Fluxo Típico de um Cliente

```
Semana 1:
  ├── Setup: criar conta, configurar setor e labels
  ├── Primeiro upload CSV (Retain): base de clientes atual
  ├── Sistema gera: health scores, predictions, alertas, causas raiz
  └── Gestor revisa dashboard e prioriza ações

Semana 2:
  ├── Primeiro upload CSV (Obtain): leads em prospecção
  ├── Sistema gera: lead scores, ICP clusters, análise de funil
  ├── Feedback loop ativado: dados de churn influenciam ICP
  └── Time comercial prioriza leads hot com perfil ideal

Mensal (ongoing):
  ├── Upload atualizado do CSV de clientes
  ├── Upload atualizado do CSV de leads
  ├── Sistema detecta tendências (melhora/piora)
  ├── Alertas automáticos para mudanças significativas
  └── Dashboards mostram evolução real dos KPIs
```

---

## Multi-Tenancy e Segurança

- Cada cliente (tenant) opera em **isolamento total** — dados nunca se misturam
- Autenticação por sessão com criptografia de senha
- 3 níveis de acesso: **Admin** (configura tudo), **Operador** (usa a plataforma), **Viewer** (só visualiza)
- Todos os dados brutos do CSV são preservados em `rawData` para auditoria
- Histórico de uploads com timestamp, usuário e mapeamento utilizado
