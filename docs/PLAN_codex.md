# Plano de Implementação para Reforçar a Atratividade Comercial

## Resumo
Objetivo: aumentar o poder de convencimento do IntelliSense para decisores de vendas, sem reposicionar o produto nem abrir um escopo grande demais. O foco é reforçar o valor percebido em três momentos-chave: **logo após o upload**, **na priorização diária do time comercial** e **na capacidade do decisor de compartilhar o insight internamente**.

A ordem sugerida é:
1. Prioridades comerciais do dia
2. Resumo executivo instantâneo do upload
3. Comparativo antes/depois de priorização
4. Saída executiva compartilhável
5. Blindagem do onboarding via CSV

## Implementação
### 1. Prioridades Comerciais do Dia
Criar uma visão orientada a operação comercial no `Obtain Sense`, acima da lista geral de leads.
- Exibir `Top N leads para agir hoje`, ordenados por score, probabilidade de conversão, LTV previsto e estágio do funil.
- Para cada lead, mostrar: motivo da prioridade, ação sugerida, impacto potencial e urgência.
- Incluir resumo agregado: receita potencial concentrada nos top leads, quantidade de leads hot sem ação recente e canais mais promissores.
- Aproveitar dados já existentes de `recommendedAction`, `ltvPrediction`, `conversionProbability`, `scoreTier` e estágio do lead.
- Se necessário, adicionar ao endpoint de prioridades campos como `estimatedImpact`, `daysWithoutAction` e `priorityReason`.

### 2. Resumo Executivo Instantâneo do Upload
Transformar a tela final de upload em uma peça de venda.
- Expandir o `intelligenceSummary` retornado pelo upload com mensagens executivas prontas.
- Incluir blocos como: “quantos leads prioritários foram encontrados”, “quanto de pipeline potencial foi identificado”, “qual canal parece mais eficiente”, “qual perfil mostra melhor aderência ao ICP”.
- Mostrar 3 a 5 insights em linguagem de negócio, curtos e prontos para leitura em reunião.
- Padronizar esses insights para aparecerem tanto no fim do upload quanto no dashboard inicial.
- Manter a origem em pipeline real, sem textos genéricos desconectados dos dados.

### 3. Comparativo Antes/Depois da Priorização
Adicionar uma camada explícita de ROI operacional.
- Criar uma visualização simples comparando:
  - universo total de leads
  - subset recomendado pelo sistema
  - concentração de receita/LTV/probabilidade de conversão nesse subset
- Exibir mensagens como: “os 20% leads prioritários concentram X% do potencial estimado”.
- Incluir isso no dashboard executivo e, se couber, no drawer ou card de prioridades.
- Caso não exista dado histórico suficiente, usar comparação estática com o conjunto atual; não depender de tracking comportamental nesta fase.

### 4. Saída Executiva Compartilhável
Facilitar a venda interna do produto pelo cliente.
- Criar um resumo compartilhável com 5 a 7 bullets executivos.
- Primeira versão pode ser uma tela “Resumo para diretoria” com botão de copiar/exportar.
- O conteúdo deve sintetizar:
  - quantidade de leads prioritários
  - principal canal
  - melhor perfil de ICP
  - risco de dispersão comercial
  - potencial financeiro estimado
- Opcionalmente gerar versão imprimível/PDF depois; na primeira entrega, `copy to clipboard` e layout limpo já resolvem bem.

### 5. Blindagem do Onboarding por CSV
Reduzir fricção e insegurança no momento mais sensível da demo.
- Adicionar template de CSV para download no upload de leads.
- Exibir checklist curto de colunas mínimas para gerar valor.
- Tornar o preview mais orientado a negócio: “com estas colunas já conseguimos score, ICP e priorização”.
- Informar claramente o que é obrigatório, o que melhora a análise e o que é opcional.
- Se o mapeamento estiver parcial, mostrar o nível de cobertura do diagnóstico em vez de só erro/bloqueio.

## APIs e Interfaces
Mudanças públicas/interfaces a prever:
- Endpoint de upload `obtain/uploads`:
  - expandir `intelligenceSummary` com `executiveInsights`, `priorityConcentration`, `bestProfile`, `dataReadinessSummary`.
- Endpoint `obtain/lead-priorities`:
  - incluir `priorityReason`, `estimatedImpact`, `daysWithoutAction`, `recommendedToday`.
- Dashboard `obtain/dashboard`:
  - incluir métricas agregadas para comparação “universo vs priorizados”.
- UI:
  - novo card/seção “Prioridades de Hoje”
  - novo bloco “Resumo Executivo”
  - novo bloco “Impacto da Priorização”
  - melhorias no `ObtainUploadPage`

## Testes e Cenários
Validar pelo menos estes cenários:
- Upload com CSV suficiente gera resumo executivo coerente com os dados importados.
- Top prioridades retorna ordenação consistente e explica claramente o motivo de cada lead estar ali.
- Comparativo de priorização mostra concentração correta de potencial no subset recomendado.
- Estados vazios continuam úteis e orientados à próxima ação.
- Upload com mapeamento parcial mostra cobertura e não quebra a UX.
- Mensagens executivas não aparecem com placeholders vazios ou números inconsistentes.
- Copiar/exportar resumo executivo gera conteúdo utilizável e legível.

## Assumptions
- O objetivo principal é **aumentar atratividade comercial e poder de demo**, não aprofundar automação operacional.
- A base atual já tem dados suficientes para calcular score, ICP, LTV previsto e recomendações sem depender de integrações novas.
- A primeira fase deve reutilizar a arquitetura atual e evitar mudanças profundas de modelo.
- O público prioritário continua sendo decisor comercial com dor de aquisição e necessidade de priorização rápida.
