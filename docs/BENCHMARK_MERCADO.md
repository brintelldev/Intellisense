# IntelliSense — Benchmark de Mercado

## Panorama Competitivo

O IntelliSense compete em dois mercados que historicamente são atendidos por ferramentas separadas:

- **Retenção / Customer Success**: Gainsight, ChurnZero, Totango, Planhat
- **Aquisição / Lead Intelligence**: HubSpot, Salesforce Einstein, 6sense, MadKudu, Clearbit, Apollo.io

Nenhuma plataforma do mercado unifica os dois mundos com feedback loop nativo. Este é o ponto de partida do diferencial do IntelliSense.

---

## Retain Sense vs Mercado de Retenção

### Matriz Comparativa

| Capacidade | Gainsight | ChurnZero | Totango | Planhat | Retain Sense |
|---|:---:|:---:|:---:|:---:|:---:|
| **Health Score configurável** | ★★★★★ | ★★★★ | ★★★★ | ★★★★★ | ★★★ |
| **Health Score hierárquico** (por produto/feature) | ✅ | ❌ | Parcial | Parcial | ❌ |
| **Health Score em tempo real** | Diário/batch | Real-time | Diário | Near real-time | Apenas no upload |
| **Churn prediction com ML** | Forte | Médio | Médio | Médio | Heurísticas |
| **Explainability (SHAP/waterfall)** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Rules Engine / Automações** | Muito forte | Médio | Médio | Forte | Básico |
| **Playbooks prescritos** | Muito avançado | Médio | Médio | Médio | Ações sugeridas |
| **Integrações nativas** (CRM, billing, suporte) | 50+ | 30+ | 30+ | 25+ | CSV upload |
| **Product Usage Tracking** (SDK in-app) | PX SDK | SDK próprio | SDK | Via API | ❌ |
| **In-app messaging** | Via PX | ✅ Nativo | ❌ | ❌ | ❌ |
| **Email automation** | Journey Orchestrator | Médio | Médio | Básico | ❌ |
| **Customer 360** (timeline, notas, reuniões) | Muito completo | Completo | Completo | Completo | Parcial |
| **Revenue Analytics** (NRR, GRR, waterfall) | Forte | Médio | Médio | Forte | Básico (MRR) |
| **AI Generativa** (sumarização, emails) | Gainsight AI | Básico | Zoe bot | Básico | ❌ |
| **Feedback loop → Aquisição** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Multi-tenant** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Dimensões custom com peso no score** | ✅ | Parcial | Parcial | ✅ | ✅ (planejado) |
| **Simulador de ROI integrado** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Time-to-value** | 2-6 meses | 1-3 meses | 1-3 meses | 1-3 meses | 1 semana |
| **Barreira de entrada** | Muito alta | Média | Baixa (free tier) | Média | Muito baixa |

### O que o Retain Sense já tem e concorrentes não

1. **Explainability real (SHAP waterfall)**: Nenhum concorrente mostra decomposição matemática do score. Gainsight mostra "fatores", mas sem magnitude e direção de impacto. O IntelliSense mostra exatamente quanto cada dimensão contribuiu para o score, positiva ou negativamente.

2. **Feedback loop para aquisição**: Quando um cliente dá churn, esse padrão alimenta automaticamente o ICP do Obtain Sense. Nenhum concorrente faz essa ponte.

3. **Simulador de ROI interativo**: Ferramenta de projeção financeira com cenários (conservador/esperado/otimista) integrada à plataforma. Concorrentes não oferecem isso.

4. **Multi-tenant nativo**: Arquitetura pensada para consultores e agências que atendem múltiplos clientes. Concorrentes são single-org.

5. **CSV-first / zero integration**: Valor no primeiro upload, sem meses de implementação ou dependência de CRM.

### O que falta no Retain Sense para paridade de mercado

#### Prioridade Alta — Essenciais para credibilidade

| Gap | O que concorrentes oferecem | Impacto | Esforço |
|-----|---------------------------|---------|---------|
| **Customer 360 / Timeline** | Histórico unificado de interações: notas de reunião, emails, chamados, ações tomadas — tudo em uma timeline por cliente | Alto | Médio |
| **Playbooks de ação** | Sequências prescritas de tarefas quando um risco é detectado (ex: dia 1 → email, dia 3 → ligação, dia 7 → visita). Gainsight tem playbooks com branching condicional. | Alto | Médio |
| **Alertas multicanal** | Notificações por email e Slack quando thresholds são cruzados, não apenas na interface | Alto | Baixo |
| **Histórico de score / trend por cliente** | Gráfico mostrando como o health score do cliente evoluiu ao longo dos uploads (score timeline) | Alto | Baixo |
| **Renewal management** | Workflow específico para gestão de renovações com timeline de 90/60/30 dias, tasks automáticas | Médio-Alto | Médio |

#### Prioridade Média — Diferenciam mas não bloqueiam

| Gap | O que concorrentes oferecem | Impacto | Esforço |
|-----|---------------------------|---------|---------|
| **Integrações básicas** (Salesforce, HubSpot, Stripe) | Conectores bidirecionais para sincronizar dados automaticamente em vez de CSV manual | Alto | Alto |
| **Health Score hierárquico** | Score por produto/serviço, não apenas score geral do cliente. Gainsight tem scores por "outcome". | Médio | Médio |
| **Scoring em tempo real / near real-time** | ChurnZero recalcula scores conforme eventos chegam, não apenas em batch. Para o modelo CSV do IntelliSense, isso não se aplica diretamente, mas uma API de ingestão de eventos seria o equivalente. | Médio | Alto |
| **Revenue analytics avançado** | NRR, GRR, revenue waterfall (new, expansion, contraction, churn), cohort analysis. Gainsight e Planhat são fortes aqui. | Médio | Médio |
| **Segmentação de modelo de atendimento** | Framework tech-touch / low-touch / high-touch baseado em receita e complexidade | Médio | Baixo |

#### Prioridade Baixa — Diferencial futuro

| Gap | O que concorrentes oferecem | Impacto | Esforço |
|-----|---------------------------|---------|---------|
| **Product usage tracking** (SDK) | ChurnZero e Gainsight PX capturam eventos de uso do produto em tempo real | Médio | Muito alto |
| **AI generativa** | Sumarizar histórico do cliente, gerar emails de follow-up, sugerir próxima ação via LLM | Médio | Alto |
| **In-app messaging** | ChurnZero envia mensagens/walkthroughs dentro do produto do cliente | Baixo | Muito alto |
| **Email automation** | Gainsight Journey Orchestrator permite campanhas multi-step com branching | Baixo-Médio | Alto |
| **NLP / Análise de sentimento** | Analisar sentimento em emails e tickets de suporte automaticamente | Baixo | Alto |

---

## Obtain Sense vs Mercado de Aquisição

### Matriz Comparativa

| Capacidade | HubSpot | Salesforce Einstein | 6sense | MadKudu | Apollo | Obtain Sense |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Lead Scoring (regras)** | ★★★★ | ★★★★ | ★★★ | ★★★★ | ★★★ | ★★★ |
| **Lead Scoring (ML preditivo)** | ★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | ★★★ | Heurísticas |
| **Explainability do score** | ❌ | Parcial (top factors) | Parcial | ✅ Forte | ❌ | ✅ SHAP |
| **ICP Builder** | ★★★ | ★★★ | ★★★★★ | ★★★★ | ★★★ | ★★★ |
| **ICP dinâmico / auto-atualizado** | ❌ | Parcial | ✅ | ✅ | ❌ | ✅ (via feedback loop) |
| **Funnel analytics** | ★★★★ | ★★★★★ | ★★★ | ★★★ | ★★★ | ★★★★ |
| **CAC vs LTV analytics** | ❌ | ❌ | ❌ | ★★★ | ❌ | ★★★★ |
| **Enriquecimento de dados externo** | ★★★ | ★★★ | ★★★★★ | Depende | ★★★★ | ❌ |
| **Intent data (1st party)** | ★★★ | ★★★ | ★★★★★ | ★★★ | ★★★ | ❌ |
| **Intent data (3rd party)** | ❌ | ❌ | ★★★★★ | ❌ | Parcial | ❌ |
| **Integrações** | ★★★★★ | ★★★★★ | ★★★★ | ★★★ | ★★★ | CSV upload |
| **ABM (Account-Based Marketing)** | ★★★ | ❌ nativo | ★★★★★ | ❌ | ★★★ | ❌ |
| **Simulador de ROI** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Retroalimentação Churn → ICP** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Multi-setor configurável** | Parcial | Parcial | ❌ (SaaS-focused) | ❌ | ❌ | ✅ |

### O que o Obtain Sense já tem e concorrentes não

1. **CAC vs LTV analytics nativo**: Surpreendentemente fraco em todo o mercado. Nenhuma plataforma oferece uma matriz visual de eficiência por campanha/canal com a profundidade proposta. MadKudu tem algo similar mas menos visual.

2. **Simulador de ROI de aquisição**: Projeção interativa de retorno com cenários. Nenhum concorrente oferece isso integrado.

3. **Retroalimentação Churn → ICP**: Dados de churn do Retain alimentam automaticamente o ICP, criando "anti-ICP patterns". 6sense e MadKudu reconhecem que isso é valioso mas não implementam.

4. **Multi-setor com labels dinâmicos**: A maioria dos concorrentes é otimizada para SaaS B2B. O IntelliSense com `sectorConfig` permite atender mineração, construção, agro, distribuição.

5. **SHAP explainability no lead scoring**: Apenas MadKudu oferece algo equivalente. HubSpot e Salesforce Einstein são "black box". O IntelliSense mostra exatamente por que cada lead recebeu cada score.

### O que falta no Obtain Sense para paridade de mercado

#### Prioridade Alta — Esperados pelo mercado ("table stakes")

| Gap | O que concorrentes oferecem | Impacto | Esforço |
|-----|---------------------------|---------|---------|
| **Histórico de score / score timeline** | Gráfico mostrando como o score do lead evoluiu ao longo do tempo. Essencial para ver se um lead está "esquentando" ou "esfriando". | Alto | Baixo |
| **Scoring em nível de Account + Contact** | Concorrentes oferecem score da empresa E score do contato individual. Obtain Sense tem apenas score do lead. | Alto | Médio |
| **Alertas de lead "esquentando"** | Notificação automática quando um lead cold vira warm ou warm vira hot. Sales precisa agir rápido. | Alto | Baixo |
| **Deduplicação e data hygiene** | Detectar leads duplicados (mesmo email, mesma empresa) e unificar registros. | Médio-Alto | Médio |
| **Multi-pipeline** | Diferentes processos de venda (ex: enterprise vs SMB, produto A vs produto B) com funis separados | Médio | Médio |

#### Prioridade Média — Diferenciam

| Gap | O que concorrentes oferecem | Impacto | Esforço |
|-----|---------------------------|---------|---------|
| **Integrações CRM** (Salesforce, HubSpot, Pipedrive) | Sincronização bidirecional de leads, deals, atividades | Alto | Alto |
| **Enriquecimento de dados** | Clearbit/Apollo preenchem dados firmográficos automaticamente (setor, tamanho, receita, tech stack) a partir do domínio ou email | Alto | Alto (depende de API terceira) |
| **Behavioral tracking básico** | Tracking de page views, email opens/clicks, form fills — sinais de intenção first-party | Médio-Alto | Alto |
| **Sequências de outreach** | Apollo e HubSpot permitem cadências de emails/calls automatizadas com tracking | Médio | Alto |
| **Attribution multi-touch** | Entender quais canais/campanhas contribuíram para cada conversão | Médio | Médio |

#### Prioridade Baixa — Diferencial futuro

| Gap | O que concorrentes oferecem | Impacto | Esforço |
|-----|---------------------------|---------|---------|
| **Intent data 3rd party** | 6sense monitora pesquisas em sites terceiros para identificar quem está ativamente buscando soluções | Alto (mas muito caro) | Muito alto |
| **Des-anonimização de website** | Clearbit Reveal e 6sense identificam qual empresa visitou seu site sem formulário | Médio | Alto (depende de IP database) |
| **ABM completo** | Orquestração multicanal (ads + email + sales) para contas-alvo | Médio | Muito alto |
| **AI generativa para emails** | Apollo e HubSpot geram emails personalizados com IA | Baixo-Médio | Médio |
| **Buying stage prediction** | 6sense prediz em qual etapa da jornada de compra a conta está (antes mesmo de contato) | Médio | Muito alto |

---

## Posicionamento Estratégico

### Onde o IntelliSense vence

```
┌─────────────────────────────────────────────────────────────┐
│                  VANTAGENS COMPETITIVAS                      │
│                                                              │
│  1. UNIFICAÇÃO DO CICLO DE VIDA                              │
│     Único a conectar Retain + Obtain com feedback loop       │
│     Concorrentes: ferramentas separadas, dados em silos      │
│                                                              │
│  2. EXPLAINABILITY                                           │
│     SHAP waterfall em TODOS os scores (churn + lead)         │
│     Concorrentes: black box ou "top factors" vagos           │
│                                                              │
│  3. ACESSIBILIDADE                                           │
│     CSV upload → insights em minutos                         │
│     Concorrentes: 1-6 meses de implementação, $50K+/ano     │
│                                                              │
│  4. FLEXIBILIDADE MULTI-SETOR                                │
│     Labels, dimensões e pesos configuráveis por setor        │
│     Concorrentes: otimizados para SaaS B2B apenas            │
│                                                              │
│  5. CAC vs LTV + ROI SIMULATORS                              │
│     Análise financeira que ninguém oferece nativamente        │
│     Concorrentes: requerem BI externo para isso              │
│                                                              │
│  6. MULTI-TENANT NATIVO                                      │
│     Modelo para consultores/agências gerenciarem clientes    │
│     Concorrentes: single-org, sem essa possibilidade         │
└─────────────────────────────────────────────────────────────┘
```

### Onde o IntelliSense perde

```
┌─────────────────────────────────────────────────────────────┐
│                  GAPS COMPETITIVOS                            │
│                                                              │
│  1. INTEGRAÇÕES                                              │
│     0 conectores nativos vs 30-50+ dos concorrentes          │
│     Mitiga: CSV flexível cobre o essencial para PMEs         │
│                                                              │
│  2. REAL-TIME                                                │
│     Score recalcula apenas no upload (batch)                 │
│     ChurnZero: recalcula em tempo real com cada evento       │
│                                                              │
│  3. AUTOMAÇÃO / PLAYBOOKS                                    │
│     Ações sugeridas em texto vs workflows automatizados      │
│     Gainsight: playbooks com branching, tasks, email, SLA    │
│                                                              │
│  4. CUSTOMER 360                                             │
│     Dados do CSV apenas vs timeline completa de interações   │
│     Concorrentes: emails, reuniões, tickets, notas, tudo     │
│                                                              │
│  5. ML PREDITIVO                                             │
│     Heurísticas vs modelos treinados em dados históricos     │
│     Mitiga: pipeline ML-ready, swap transparente futuro      │
│                                                              │
│  6. ENRIQUECIMENTO DE DADOS                                  │
│     Nenhum vs Clearbit/Apollo com milhões de empresas        │
│     Para PMEs sem CRM, isso é menos crítico                  │
│                                                              │
│  7. INTENT DATA                                              │
│     Nenhum vs 6sense com bilhões de sinais de intenção       │
│     Nicho enterprise, não é prioridade para o público-alvo   │
└─────────────────────────────────────────────────────────────┘
```

### Público-alvo ideal (onde os gaps importam menos)

O IntelliSense não compete diretamente com Gainsight ou 6sense. O posicionamento ideal é:

| Perfil | Por que IntelliSense é melhor que concorrentes |
|--------|-----------------------------------------------|
| **PMEs B2B sem CRM robusto** | Não precisam de Salesforce para começar. CSV do ERP/planilha basta. |
| **Empresas B2B não-SaaS** (industrial, agro, distribuição, serviços) | Concorrentes são otimizados para SaaS. IntelliSense é setor-agnóstico. |
| **Consultorias e agências de CS** | Multi-tenant permite gerenciar vários clientes numa única plataforma. |
| **Times pequenos de CS/vendas** (1-5 pessoas) | Interface simples, sem meses de implementação, sem admin dedicado. |
| **Empresas que querem entender o "porquê"** | Gestores que precisam justificar decisões para diretoria com dados explicáveis. |

---

## Roadmap Sugerido por Prioridade de Mercado

### Fase 1 — Paridade mínima (MVP credível)
*Sem esses itens, a plataforma não passa a avaliação inicial de um prospect.*

- [ ] Upload CSV funcionando end-to-end com scoring real (não mock)
- [ ] Health Score e Lead Score calculados com heurísticas inteligentes
- [ ] SHAP waterfall com dados reais
- [ ] Alertas na interface (health drops, churn risk, contract expiring)
- [ ] Histórico de score por cliente/lead (score timeline)
- [ ] Empty states com CTA de upload
- [ ] Dashboards consumindo dados reais
- [ ] Data freshness indicator

### Fase 2 — Diferenciação (wow factor na demo)
*Itens que fazem o prospect dizer "isso os outros não têm".*

- [ ] Feedback loop Retain → Obtain visível na interface
- [ ] CAC vs LTV matrix com dados reais
- [ ] ROI Simulator com projeções baseadas nos dados do cliente
- [ ] Mapeamento inteligente de colunas CSV (auto-detect)
- [ ] Dimensões customizáveis com peso no score
- [ ] Alertas por email (notificação fora da plataforma)

### Fase 3 — Profundidade (retenção de clientes da plataforma)
*Itens que mantêm o cliente usando a plataforma dia a dia.*

- [ ] Customer 360 com timeline de interações/notas
- [ ] Playbooks simples (sequência de tasks disparadas por risco)
- [ ] Integrações básicas (HubSpot, Salesforce — pelo menos leitura)
- [ ] Revenue analytics (NRR, GRR, cohort analysis)
- [ ] Multi-pipeline para Obtain

### Fase 4 — Escala (competir com mid-market)
*Para quando o IntelliSense tiver traction e quiser subir de segmento.*

- [ ] ML real para churn prediction (substituir heurísticas)
- [ ] API de ingestão de eventos (além do CSV)
- [ ] Enriquecimento de dados (integração Clearbit ou similar)
- [ ] AI generativa (sumarização de accounts, sugestão de email)
- [ ] Webhook/Slack notifications

---

## Conclusão

O IntelliSense não precisa competir feature-a-feature com Gainsight ou 6sense. O posicionamento é diferente: **plataforma unificada de lifecycle intelligence, acessível, explicável e multi-setor**. 

Os diferenciais reais — feedback loop, SHAP explainability, CAC vs LTV, ROI simulators, multi-tenant, CSV-first — são genuínos e não existem combinados em nenhum concorrente.

Os gaps mais críticos para credibilidade imediata não são de funcionalidade avançada, mas de **dados reais fluindo pelo sistema**: o upload funcionando end-to-end, scores calculados de verdade, alertas gerados automaticamente, e dashboards sem dados mockados.
