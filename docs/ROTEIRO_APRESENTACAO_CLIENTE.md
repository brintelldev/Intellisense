# Roteiro de Apresentação ao Cliente — IntelliSense

> Script de ~18 minutos (15 min demo + 3 min fechamento). Falas prontas entre aspas, ações por tela, plano B e respostas a objeções. Pensado para ser lido quase de olhos fechados durante a apresentação ao vivo.

---

## Pré-voo (5 min antes)

- [ ] Ambiente up: `docker compose -f docker-compose.prod.yml --env-file .env.prod.local up -d` (ou local `npm run dev`)
- [ ] Snapshot restaurado se necessário: `scripts/demo/restore_demo.sh`
- [ ] Containers saudáveis: `docker ps` mostra server + client + postgres
- [ ] Login funcional em aba anônima: `demo@dcco.com.br` / `Demo@2026`
- [ ] CSVs em `~/Desktop/demo/`:
  - `csv_a_retain_coloquial.csv` (80 clientes, UTF-8, coloquial)
  - `csv_b_obtain_leads.csv` (60 leads)
  - `csv_d_retain_corporativo_latin1.csv` (20 clientes, Latin-1, `;`, R$ BR, datas DD/MM/YYYY)
- [ ] Abas abertas em ordem: `/`, `/retain/upload`, `/retain`, `/retain/predictions`
- [ ] Zoom/projetor testados
- [ ] Celular silenciado

---

## 0. Abertura (1 min) — [tela: slide fora do sistema ou `/login`]

> "Antes de abrir a plataforma, duas perguntas rápidas.
>
> Primeira: *quanto vocês perderam em receita nos últimos 12 meses com clientes que cancelaram?*
>
> Segunda: *qual foi o CAC médio para substituir esse cliente perdido?*
>
> Normalmente a resposta da primeira é 'não sei ao certo'. E a segunda é 3 a 5 vezes maior do que o cliente gerava por mês.
>
> O IntelliSense existe para fechar essa conta. Retenção e aquisição deixam de ser dois problemas separados e viram um único loop de inteligência. Quem você perde hoje refina o perfil de quem você deve prospectar amanhã — e vice-versa. Nenhuma ferramenta no mercado faz isso. Vou mostrar em 15 minutos."

---

## 1. Upload — o primeiro "uau" (2 min) — [tela: `/retain/upload`]

**Ações:**
- Arrastar **CSV A** (80 clientes).
- Narrar os 4 steps do wizard:
  1. **Upload** — "nenhum formato obrigatório, o sistema se adapta"
  2. **Mapping inteligente** — apontar sugestões com confidence (alta/média/baixa) e o badge "📚 Do último upload" quando existir histórico
  3. **Preview interpretado** — chips: `encoding detectado`, `delimitador`, `escala NPS normalizada`, `X de 9 dimensões disponíveis`
  4. **Resultado** — 5 cards coloridos: clientes analisados, predições geradas, alertas, em risco crítico, **receita sob risco**

**Fala:**
> "Este preview é importante: a plataforma não processa às cegas. Ela mostra o que entendeu antes de gravar. Encoding, delimitador, escala do NPS, quantas das 9 dimensões de saúde ela conseguiu identificar no arquivo de vocês.
>
> Em 8 segundos o CSV virou inteligência. Concorrentes levam de 2 a 6 meses para chegar a esse ponto — porque dependem de integração com CRM, billing, suporte. Aqui o valor é no primeiro upload."

---

## 2. Dashboard Retain — o raio-X da base (2 min) — [tela: `/retain`]

**Ações (percorrer em ordem, sem pressa):**
- **Health Score gauge** no topo
- **Distribuição de risco** (donut): low / medium / high / critical
- **Receita em risco** (cartão destacado)
- **Cobertura de dados**: `X / 9 dimensões disponíveis`
- **Evolução temporal** (snapshot evolution): linha do tempo da saúde da base

**Fala:**
> "O Health Score médio da base é [X]. É um número honesto: calculado a partir de 9 dimensões universais, e quando uma dimensão está ausente, o peso das outras é redistribuído proporcionalmente. Sem inventar meio-termo neutro para dados que vocês não têm.
>
> À direita, a distribuição de risco: quantos clientes estão em cada faixa. E este cartão aqui — esta é **a conta que ninguém quer fazer**: quanto da receita anual de vocês depende de clientes que hoje estão em vermelho.
>
> E este bloco de evolução temporal: cada upload vira um snapshot. Vocês estão vendo a saúde da base **ao longo do tempo**, não uma foto estática."

---

## 3. Predições explicáveis — o que ninguém mais tem (2 min) — [tela: `/retain/predictions`]

**Ações:**
- Lista ordenada por probabilidade de churn
- Clicar no **cliente crítico de maior receita** (~R$ 180k/mês)
- Abrir drawer lateral → **SHAP waterfall**

**Fala:**
> "Olha o que a plataforma faz aqui: ela não diz apenas *'este cliente tem 87% de chance de churn'*. Ela mostra exatamente **quais fatores** empurraram o score para baixo, e em **qual magnitude**.
>
> Satisfação pesou -22 pontos. Atraso de pagamento, -15. Uso caindo, -12. Isto é SHAP — a mesma técnica matemática usada em modelos regulados de crédito e fraude. **Gainsight, ChurnZero, Planhat não fazem isso.** Eles dizem 'fatores', sem direção nem magnitude.
>
> Abaixo vem a **ação recomendada** — não genérica, específica para o fator dominante. E do lado, quanto vale a receita se vocês retiverem: R$ 180 mil por mês, R$ 2,1 milhões por ano."

---

## 4. Voz do Cliente — sentimento em R$ (2 min) — [tela: `/retain/voz-do-cliente`]

**Ações:**
- **NPS grande** + distribuição (promotores / passivos / detratores)
- **Receita em risco dos detratores** (cartão vermelho)
- **Tabela de detratores ordenada por receita**
- **Mural de verbatims** (citações cruas)
- **Temas de ticket** (barras horizontais)

**Fala:**
> "Satisfação sem receita do lado é hobby. Aqui cada detrator tem nome, valor contratual e o que ele literalmente disse.
>
> *'Suporte demorou 5 dias pra responder'* — dito pelo cliente de R$ 35 mil por mês. É concreto, é acionável, e está priorizado por impacto: ligue primeiro para quem mais dói perder.
>
> E os temas de ticket aqui embaixo mostram **o que mais incomoda a base**. Se 30% dos chamados são sobre performance, essa é a conversa que vocês precisam ter com produto ou engenharia — com dado, não com percepção."

---

## 5. Obtain Sense — do outro lado do funil (2 min)

**Ações:**
- **Upload rápido do CSV B** em `/obtain/upload` (60 leads)
- `/obtain/leads` — lead scoring 0-100 com hot / warm / cold / disqualified + SHAP por lead
- `/obtain/icp` — radar de clusters ICP / bom / anti-ICP, derivados dos clientes reais
- `/obtain/cac-ltv` — matriz por canal, destacar um canal sangrando (CAC alto, LTV baixo)
- `/obtain/funnel` — gargalos por etapa + receita parada

**Fala:**
> "Mesmo rigor, outro lado do ciclo. Lead scoring com SHAP por lead — vocês entendem **por que** um lead é quente, não só que ele é.
>
> O ICP aqui é construído a partir dos dados **reais** da base de vocês, não de um modelo genérico. Aqueles três clusters são: ICP, bom e anti-ICP.
>
> CAC vs LTV por canal: olha este canal aqui — CAC alto, LTV baixo. É sangria. Cortar 30% do investimento aqui já libera orçamento para dobrar no canal que está entregando."

---

## 6. Feedback loop — o diferencial absoluto (2 min) — [telas: `/retain/customers` → `/obtain/icp` → `/obtain/cac-ltv`]

**Ações:**
- `/retain/customers` → abrir o cliente crítico de maior receita
- Menu → **"Marcar como churned"**
- Navegar para `/obtain/icp` — o cluster afetado se move no radar
- Navegar para `/obtain/cac-ltv` — o canal de origem desse cliente recebe uma marcação

**Fala:**
> "Acabou de acontecer uma coisa que **nenhum concorrente faz**: o churn deste cliente realimentou automaticamente o perfil ideal de aquisição e a análise de canal.
>
> Vocês **deixam de investir em prospectar mais clientes parecidos com o que acabaram de perder**. E o canal que trouxe esse cliente ganha um peso diferente na decisão de orçamento.
>
> **Este é o loop.** Retenção informa aquisição. Aquisição informa retenção. Em tempo real. É por isso que a plataforma se chama Intelli**Sense** — ela *entende* o ciclo inteiro."

---

## 7. Scoring Config ao vivo (1 min) — [tela: `/settings` aba Scoring Config]

**Ações:**
- Slider de `dimSatisfaction`: 20 → 28
- Slider de `dimPaymentRegularity`: 18 → 10 (soma = 100)
- Clicar "Salvar e Recalcular"
- Voltar para `/retain/predictions` — ordem dos clientes mudou

**Fala:**
> "O modelo é seu. Se o negócio de vocês é serviços industriais, satisfação pesa diferente. Se é financeiro, adimplência pesa diferente. Vocês configuram, a plataforma recalcula **toda a base em segundos**, e o SHAP reflete os novos pesos.
>
> Isto é customização no nível certo: sem precisar de consultoria paga nem de código."

---

## 8. CSV corporativo — resiliência que impressiona TI (1 min) — [tela: `/retain/upload`]

**Ações:**
- Arrastar **CSV C / D** (Latin-1, `;`, "R$ 1.234,56", datas DD/MM/YYYY, 2 colunas sem match, NPS 0–10)
- Apontar os chips no preview: `encoding: latin1`, `delimitador: ;`, `NPS normalizado de score-10`, `2 colunas não mapeadas`
- Confirmar → resultado: **"20 atualizados, 0 criados"** (upsert por customerCode)

**Fala:**
> "Este é um CSV que saiu direto de um ERP corporativo: encoding da década de 80, ponto-e-vírgula como separador, moeda brasileira com R$, datas no padrão brasileiro. Muitas plataformas travam aqui.
>
> Esta aceita, detecta, normaliza. E vejam aqui: '20 atualizados, 0 criados'. Ela reconheceu que esses clientes já existiam na base e fez **upsert** — não duplicou nada. Vocês podem subir um CSV por semana, por mês, e a evolução fica registrada."

---

## 9. Simuladores de ROI (1 min) — [tela: `/retain/roi`]

**Ações:**
- Mostrar 4 sliders + 3 cenários (conservador / esperado / otimista)
- Destacar o número em reais do cenário esperado
- Mencionar o gêmeo em `/obtain/roi` (5 sliders para aquisição)

**Fala:**
> "Quando vocês levarem esta conversa para o CFO, **este é o slide que fecha**. ROI projetado da ação de retenção em três cenários, com números em reais, baseado nos dados da base de vocês.
>
> E tem o gêmeo na aquisição. **Nenhuma ferramenta de CS do mercado tem isso integrado.**"

---

## 10. Fechamento — diferenciais e próximos passos (2 min) — [tela: Lifecycle `/`]

Voltar à tela Lifecycle no topo. Resumir com 5 pontos:

1. **Feedback loop Retain ↔ Obtain** — ninguém mais tem.
2. **SHAP em todo score** — explainability que Gainsight e 6sense não entregam.
3. **CSV-first, valor no primeiro upload** — time-to-value de 1 semana vs 2–6 meses dos concorrentes.
4. **Multi-tenant nativo** — se vocês forem uma consultoria, cada cliente vira um tenant isolado.
5. **ROI e CAC×LTV integrados** — decisão financeira na mesma tela da operacional.

**Fala:**
> "Vocês acabaram de ver, em 15 minutos, o que levou concorrentes 10 anos para construir — e ainda assim a gente faz duas coisas que eles não fazem: o feedback loop e a explainability matemática.
>
> O próximo passo é simples: um upload dos dados reais de vocês, em ambiente isolado, e na próxima reunião vocês veem a própria base com nome, sobrenome e valor. **Quando podemos agendar?**"

---

## A. Plano B — ordem de corte se algo quebrar

1. Se Latin-1 falhar → pular cena 8 (-1 min)
2. Se Voz do Cliente quebrar → pular cena 4 (-2 min)
3. Se feedback loop não redistribuir visualmente → falar sobre ele mostrando só `/obtain/icp` (-1 min)
4. Plano mínimo (~8 min): cenas 1, 2, 3, 10

---

## B. Respostas rápidas a objeções prováveis

| Objeção | Resposta |
|---|---|
| *"Nosso dado está num ERP, não em CSV"* | "CSV é o primeiro passo. Na v2 entram conectores nativos para Salesforce, HubSpot, Stripe. Hoje o CSV já entrega valor em uma semana." |
| *"SHAP funciona com heurística, não com ML?"* | "Sim. A arquitetura é ML-ready. A primeira versão usa heurísticas calibradas com você. Quando houver 12 meses de histórico, trocamos para um modelo treinado sem mudar a interface." |
| *"Quanto tempo para implementar?"* | "Primeiro upload: hoje. Primeiro insight acionável: hoje. Integração com fontes automatizadas: fase 2, 30-60 dias." |
| *"E LGPD?"* | "Dados ficam em Postgres multi-tenant com isolamento por `tenantId` em cada query. Podemos hospedar na infra do cliente se for requisito." |
| *"Vocês têm quantos clientes hoje?"* | "Vocês seriam nosso primeiro cliente-âncora. Em troca: pricing de fundador, roadmap co-desenhado, e acesso direto ao time." |
| *"E se a gente quiser integrar com Slack/email?"* | "Está no roadmap de 60 dias. Hoje os alertas estão no sistema; multicanal é fase 2." |

---

## C. Métricas-alvo durante o ensaio

- Tempo total ≤ 16 min (buffer de 2 min para perguntas espontâneas)
- Zero erro no console do browser durante toda a apresentação
- Preview interpretado carrega em < 2s no CSV de 80 linhas
- Nenhuma tela mostra `undefined`, `NaN` ou lista vazia sem estado educado

---

## D. Arquivos de referência para Q&A

- `docs/COMO_FUNCIONA.md` — explicação profunda do motor de scoring
- `docs/BENCHMARK_MERCADO.md` — tabelas comparativas vs Gainsight, ChurnZero, HubSpot, 6sense
- `docs/DEMO_SEXTA_IMPLEMENTACAO.md` — detalhe técnico de cada feature
- `scripts/demo/` — dados-herói e restaurador de snapshot

## E. Rotas exercitadas

`/` · `/retain/upload` · `/retain` · `/retain/predictions` · `/retain/voz-do-cliente` · `/retain/customers` · `/retain/roi` · `/obtain/upload` · `/obtain/leads` · `/obtain/icp` · `/obtain/cac-ltv` · `/obtain/funnel` · `/obtain/roi` · `/settings`
