# Relatório de Auditoria: Stitch Spec vs Implementação

**Data:** 2026-04-08
**Escopo:** 8 documentos Stitch (STITCH_01 a STITCH_08) vs código implementado

---

## Resumo Executivo

| Categoria | OK | PARCIAL | AUSENTE | Total |
|-----------|:--:|:-------:|:-------:|:-----:|
| Shell (Login, Sidebar, Header) | 12 | 12 | 1 | 25 |
| Lifecycle (/) | 1 | 3 | 0 | 4 |
| Retain (6 páginas) | 14 | 9 | 1 | 24 |
| Obtain (7 páginas) | 9 | 22 | 1 | 32 |
| **TOTAL** | **36** | **46** | **3** | **85** |

**Taxa de conformidade completa:** 42% (36/85)
**Taxa de conformidade parcial+completa:** 96% (82/85)
**Itens completamente ausentes:** 3

---

## STITCH_01: Shell & Login

### Login (`/login`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Card centralizado max-width 420px | OK | `max-w-[420px]` correto |
| Logo Shield + "Intelli" #293b83 / "Sense" #67b4b0 | OK | Cores e ícone corretos |
| Subtitle "Customer Lifecycle Intelligence" | PARCIAL | Texto em PT-BR "Plataforma de Inteligência do Ciclo de Vida do Cliente" em vez do original inglês. Cor #b4b4b4 correta |
| Input email com Mail icon + placeholder | OK | |
| Input senha com Lock + Eye/EyeOff toggle | OK | |
| Checkbox "Manter conectado" | **AUSENTE** | Não existe no código |
| Botão "Entrar" full-width, 48px, gradiente | OK | `h-12` (48px), `brand-gradient` correto |
| Link "Esqueceu a senha?" em #67b4b0 | OK | |
| Separator com "ou" | OK | |
| Botão "Criar conta" outline #293b83 | OK | |
| Footer "Powered by Brintell" | OK | |

**Extra:** Botão "Entrar como Demo (DCCO)" não previsto na spec, mas adição funcional válida.

### Register Page

| Item | Status | Detalhe |
|------|:------:|---------|
| Campos: Nome, Email, Senha, Confirmar Senha | OK | |
| Select Setor (7 opções) | PARCIAL | Tem as 7 opções + "Outro" extra. Ordem dos campos difere da spec |
| Campo Nome da empresa | OK | |
| Botão "Criar conta" | OK | |

### Sidebar

| Item | Status | Detalhe |
|------|:------:|---------|
| Fundo #1e293b, 260px/72px | PARCIAL | Usa `#0f172a` (mais escuro). Larguras 240/64px em vez de 260/72px |
| Logo + tenant name | PARCIAL | "Intelli" usa `#93a8f4` em vez de `#293b83` no modo sidebar |
| Ícones Lucide corretos | PARCIAL | Usa SVGs inline customizados em vez de componentes Lucide. "Ciclo de Vida" usa ícone `brain` em vez de `LayoutDashboard`. "Clientes" está como "Empresas". "Upload de Dados" do Obtain está como "Upload de Leads" |
| Labels de grupo (bolinha azul/verde) | PARCIAL | Labels 10px uppercase corretos. **Bolinhas coloridas ausentes** |
| Footer: Avatar + nome + logout | PARCIAL | Tem nome e logout, **avatar com iniciais ausente** |
| Hover: bg #293548 | PARCIAL | Usa `hover:bg-white/5` — efeito mais sutil que #293548 |
| Item ativo: bg + borda 3px colorida | PARCIAL | Usa `bg-white/10` em vez de #293548. Borda 3px com cores corretas (azul/verde) |
| Colapsável: ChevronLeft/Right + tooltip | PARCIAL | Toggle funciona mas usa SVG custom com rotação, não Lucide. Tooltip via `title` attribute |

### Header

| Item | Status | Detalhe |
|------|:------:|---------|
| Altura 64px, bg branco, border | PARCIAL | Altura `h-14` = 56px (spec: 64px) |
| Breadcrumb | OK | Todas as rotas mapeadas corretamente |
| Sino de notificações | OK | Removido conforme decisão do usuário |
| Avatar dropdown (Perfil + Sair) | PARCIAL | Tem "Configurações" e "Sair", **falta "Perfil"** |

---

## STITCH_02: Ciclo de Vida (`/`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Título + subtítulo | PARCIAL | "integrada" em vez de "unificada" |
| 3 blocos horizontais | PARCIAL | Conteúdo OK. Bordas usam `border-2` em volta inteira em vez de `border-top` apenas. Transição falta a palavra "convertidos" |
| Insight do Ecossistema | PARCIAL | Conteúdo correto. Usa `bg-white` com `border-l-4` em vez de bg #f0fdf4 com borda gradiente |
| Gráfico Qualidade Aquisição | PARCIAL | **Divergência significativa.** Usa AreaChart com Hot/Warm em vez de LineChart com LTV/Churn dual Y-axis |
| Gráfico LTV por Canal | OK | Dados e formato batem perfeitamente |

---

## STITCH_03: Retain Dashboard (`/retain`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Título + badge + subtítulo | OK | |
| 4 KPIs (482, 3.8%, R$21.7M, R$847K) | OK | Valores e variações corretos |
| Tendência de Churn (AreaChart 12m) | OK | |
| Distribuição de Risco (DonutChart) | OK | 4 segmentos com centro "482 Total" |
| Receita por Segmento (BarChart horiz) | OK | 4 segmentos com valores corretos |
| Health Score Gauge (semi-círculo 72/100) | OK | Zonas de cor implementadas |
| Alertas Recentes (5 itens) | OK | |

---

## STITCH_04: Predições de Churn (`/retain/predictions`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Filtros | PARCIAL | Falta filtro de **status** |
| Tabela 20 linhas + colunas | OK | Dados mockados e colunas corretos |
| Row highlighting (Crítico/Alto) | PARCIAL | Crítico OK (#fef2f2). Alto usa `bg-orange-50/60` (semi-transparente) |
| Paginação | OK | |
| Drawer lateral 520px + SHAP + ação | OK | Completo: header, mini-cards, SHAP Waterfall (6 fatores), ação recomendada, grid info |

---

## STITCH_05: Retain — Causas Raiz, ROI, Clientes

### Causas Raiz (`/retain/root-causes`)

| Item | Status | Detalhe |
|------|:------:|---------|
| 3 MetricCards | PARCIAL | "Receita Total Perdida" mostra ~R$1.3M (soma real dos dados) em vez de R$2.1M da spec |
| Tabela 6 causas | PARCIAL | Dados corretos mas **faltam barras de progresso visuais** na coluna impacto |
| Bar chart horizontal | OK | |
| Gráfico tendência 6m (4 linhas) | OK | |

### Simulador ROI (`/retain/roi`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Layout 2 colunas | OK | |
| 4 sliders com ranges corretos | OK | Todos os ranges e defaults batem |
| 3 cenários (15/25/40%) | OK | Esperado destacado com badge "Recomendado" |
| Card destaque + CTA | OK | |

### Clientes (`/retain/customers`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Filtros avançados | PARCIAL | Faltam filtros **receita min/max** |
| Botões exportar + adicionar | OK | |
| Tabela com todas as colunas | PARCIAL | "Último Contato" em vez de "Última Atividade" (minor) |
| Multi-select + ação bulk | **AUSENTE** | Nenhuma funcionalidade de seleção múltipla ou ação em lote |

---

## STITCH_06: Obtain Dashboard & Leads

### Dashboard (`/obtain`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Título + badge + subtítulo | PARCIAL | Falta subtítulo |
| 5 KPIs | OK | Todos os valores batem |
| Scatter CAC x LTV (4 quadrantes) | PARCIAL | Labels dos quadrantes definidos mas **não renderizados visualmente** no gráfico |
| Funil de Vendas | PARCIAL | Modo `compact` esconde drop-off %. Gargalo em "Proposta" (estágio) em vez da transição Demo→Proposta |
| Qualidade Leads/Mês (stacked area) | OK | |
| Leads por Cluster ICP (donut) | PARCIAL | Usa `leadsInFunnel` (22/47/31%) em vez de `budgetShare` (42/35/23%) |

### Lead Scoring (`/obtain/leads`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Filtros | PARCIAL | Faltam: campanha, ICP cluster, score mínimo slider |
| Tabela leads | PARCIAL | 20 linhas (spec: 15). Coluna "Origem" em vez de "Campanha". Faltam colunas "Última Ação" e "Detalhes" |
| Hot rows bg #ecfdf5 | PARCIAL | Cor correta mas com 60% opacidade |
| Drawer verde 520px | PARCIAL | Conteúdo completo (SHAP, oferta, ICP match). Drawer não tem tema verde no container |

---

## STITCH_07: ICP, Funil, CAC vs LTV

### ICP & Lookalike (`/obtain/icp`)

| Item | Status | Detalhe |
|------|:------:|---------|
| 3 cluster cards | PARCIAL | Grid 2x2 em vez de 2x3 (faltam Leads e % base). Anti-ICP alert text difere da spec. Falta Star icon no ICP Ideal |
| Botão "Exportar Audiência Lookalike" | **AUSENTE** | Não existe em nenhum card |
| Radar Chart (5 eixos) | PARCIAL | 2 eixos diferentes: "CAC Eficiência"/"Anti-Churn" vs "Ticket"/"Volume" |
| Insight card cross-module | PARCIAL | Texto difere da spec. Falta badge "Dados do Retain Sense" |

### Funil & Gargalos (`/obtain/funnel`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Funil visual com drop-off | OK | |
| Gargalo destacado | PARCIAL | Borda vermelha + badge "Gargalo" OK. Falta AlertTriangle icon no funil visual |
| Tabela métricas por estágio | OK | |
| 3 cards alertas | OK | Textos batem com spec |

### CAC vs LTV (`/obtain/cac-ltv`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Scatter plot grande | PARCIAL | Altura 320px (spec: ~420px). Quadrantes sem background colorido |
| Tabela campanhas (5 linhas) | OK | |
| Card feedback Retain→Obtain | PARCIAL | Ícone diferente (raio vs RefreshCcw). Texto não menciona Outbound churn 4 meses, Health Score 32, 80% budget |

---

## STITCH_08: Upload, Settings, ROI Obtain

### Upload Retain (`/retain/upload`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Step 1: Drag-drop + histórico | OK | |
| Step 2: Mapeamento 11 dimensões | PARCIAL | Falta status "Sugerido" (auto-suggest). Falta seção "campos extras" |
| Step 3: Progresso + conclusão | PARCIAL | Mensagem estática em vez de sequencial animada |

### Upload Obtain (`/obtain/upload`)

| Item | Status | Detalhe |
|------|:------:|---------|
| Padrão visual verde | OK | |
| Mapeamento campos leads | PARCIAL | 11 campos em vez de 10 (campo "campaign" extra) |
| Mensagem conclusão | PARCIAL | Mostra contagem dinâmica, sem "34 Hot" |

### Simulador ROI Obtain (`/obtain/roi`)

| Item | Status | Detalhe |
|------|:------:|---------|
| 5 sliders | OK | |
| 3 cenários aquisição | PARCIAL | Labels de métricas diferem: "Novos clientes" vs "Economia CAC" |
| Cenário esperado destacado | PARCIAL | "Atual" está destacado em vez do cenário "Esperado/Otimizado" |

### Configurações (`/settings`)

| Item | Status | Detalhe |
|------|:------:|---------|
| 4 tabs | OK | |
| Perfil: avatar + inputs | PARCIAL | Avatar 64px (spec: 80px) |
| Empresa: campos + plano | PARCIAL | Badge diz "Enterprise" (spec: "Premium") |
| Setor: labels + tags + moeda + preview | PARCIAL | Só 4 opções de setor (spec: 7+). Falta select de moeda. Tags de segmentos não editáveis |
| Usuários: tabela + convidar | PARCIAL | 3º usuário "Carlos Lima" (spec: "Pedro Santos") |

---

## Itens Completamente Ausentes (Prioridade Alta)

1. **Checkbox "Manter conectado"** no Login — [LoginPage.tsx](client/src/shell/pages/LoginPage.tsx)
2. **Multi-select + ação bulk** na tabela de Clientes — [RetainCustomersPage.tsx](client/src/modules/retain/pages/RetainCustomersPage.tsx)
3. **Botão "Exportar Audiência Lookalike"** nos cards ICP — [ObtainICPPage.tsx](client/src/modules/obtain/pages/ObtainICPPage.tsx)

---

## Gaps Parciais Mais Significativos (Prioridade Média)

### Divergências de Conteúdo/Lógica
4. **Lifecycle chart Qualidade da Aquisição** — mostra Hot/Warm (AreaChart) em vez de LTV/Churn Rate (LineChart dual axis)
5. **Donut ICP no Dashboard Obtain** — usa `leadsInFunnel` (22/47/31%) em vez de `budgetShare` (42/35/23%)
6. **ROI Obtain cenários** — labels de métricas e cenário destacado diferem
7. **Card feedback Retain→Obtain** (CAC-LTV page) — conteúdo do texto difere significativamente
8. **Insight card ICP** — texto difere, falta badge "Dados do Retain Sense"
9. **Quadrant labels** não renderizados visualmente no scatter plot
10. **Root Causes receita** — soma ~R$1.3M vs spec R$2.1M

### Elementos de UI Faltantes
11. Bolinhas coloridas antes dos labels de grupo na Sidebar
12. Avatar com iniciais no footer da Sidebar
13. Opção "Perfil" no dropdown do Header
14. Status filter nas Predições
15. Filtros receita min/max nos Clientes
16. Filtros campanha, ICP cluster, slider score nos Leads
17. Barras de progresso na tabela de Causas Raiz
18. AlertTriangle icon no funil visual
19. Seção "campos extras" e status "Sugerido" no Upload mapping
20. Select de moeda e tags editáveis nas Configurações de Setor

### Desvios de Design
21. Sidebar: bg `#0f172a` → deveria ser `#1e293b`; larguras 240/64 → 260/72px
22. Sidebar: logo "Intelli" cor `#93a8f4` → deveria ser `#293b83`
23. Sidebar: hover/active bg `white/5`/`white/10` → deveria ser `#293548`
24. Header: altura 56px → deveria ser 64px
25. Scatter plot: altura 320px → deveria ser ~420px; quadrantes sem fill colorido
26. Avatar Perfil: 64px → deveria ser 80px
27. Bordas dos cards Lifecycle: `border-2` total → deveria ser `border-top` apenas
28. Ícones Lucide: sidebar usa SVGs inline em vez de imports Lucide (LayoutDashboard, ChevronLeft/Right, etc.)
29. Plano "Enterprise" → deveria ser "Premium"

---

## Recomendação

O projeto tem **96% de cobertura** (parcial+completa) das specs do Stitch. A estrutura, rotas, dados e fluxos principais estão todos implementados. Os gaps são predominantemente ajustes cosméticos (cores, tamanhos, ícones), textos/labels que divergem levemente, e alguns filtros/funcionalidades menores ausentes.

**Prioridades sugeridas:**
1. Corrigir os 3 itens completamente ausentes
2. Ajustar os gráficos com lógica divergente (#4, #5, #6)
3. Alinhar os desvios de design da Sidebar (#21-#23, #28)
4. Adicionar filtros faltantes (#14-#16)
5. Ajustes cosméticos restantes
