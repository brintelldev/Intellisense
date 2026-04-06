# Prompt 8/8 — Upload de Dados + Configuracoes + ROI Obtain

Crie 4 paginas finais: Upload Retain, Upload Obtain, Simulador ROI Obtain e Configuracoes.

## Design System resumido
- Fonte: Inter. Azul #293b83 (Retain), Verde #10B981 (Obtain). Fundo #f8fafc, cards brancos shadow-sm rounded-xl. shadcn/ui. Lucide. PT-BR.

---

## Pagina 1: Upload Retain (/retain/upload)

**Header:** "Upload de Dados" + badge "Retain Sense" azul

### Passo 1: Area de upload
Card branco grande, centralizado:
- Area com borda tracejada 2px #b4b4b4, rounded-xl, padding 48px, centralizado
- Icone CloudUpload (48px, cinza #b4b4b4) centralizado
- Texto 16px: "Arraste seu arquivo CSV ou clique para selecionar"
- Texto 13px cinza: "Formatos aceitos: .csv, .xlsx — Maximo 50MB"
- Ao hover: borda muda para #293b83, fundo levemente azulado

### Abaixo: Historico de uploads
Card com titulo "Uploads Anteriores":
- Tabela simples 4 colunas: Arquivo, Data, Linhas, Status
- 3 linhas mock:
  - base_clientes_mar2026.csv | 01/03/2026 | 482 | Badge "Completo" verde
  - base_clientes_fev2026.csv | 01/02/2026 | 478 | Badge "Completo" verde
  - teste_import.csv | 15/01/2026 | 12 | Badge "Erro" vermelho

### Passo 2: Mapeamento de colunas (aparece apos upload)
Card com titulo "Mapeie suas colunas para as dimensoes do Retain Sense" (16px SemiBold)

Subtitulo: "O sistema sugere mapeamentos automaticos. Ajuste conforme necessario." (13px cinza)

Layout: cada dimensao e uma linha com:
- Nome da dimensao (esquerda, 14px)
- Select/dropdown com colunas do CSV (centro)
- Status icon (direita): check verde = mapeado, circulo amarelo = sugerido, traço cinza = vazio

| Dimensao | Coluna Sugerida | Status |
|----------|----------------|--------|
| Identificador do cliente | [cod_cliente] | ✅ Mapeado |
| Nome | [razao_social] | ✅ Mapeado |
| Receita | [valor_contrato_mensal] | 💡 Sugerido |
| Regularidade de pagamento | [dias_atraso_medio] | 💡 Sugerido |
| Tempo de relacionamento | [meses_cliente] | 💡 Sugerido |
| Frequencia de interacao | — selecione — | ➖ Nao mapeado |
| Volume de suporte | [qtd_chamados] | 💡 Sugerido |
| Satisfacao | — selecione — | ➖ |
| Vinculo contratual | [data_fim_contrato] | 💡 Sugerido |
| Intensidade de uso | — selecione — | ➖ |
| Recencia | — selecione — | ➖ |

**Indicador de qualidade:**
Barra de progresso: "6 de 11 dimensoes mapeadas"
Badge: "Precisao estimada: **Media**" (amarelo). Se >8 dimensoes: "Alta" (verde). Se <4: "Baixa" (vermelho).

**Secao "Campos extras":**
Texto: "Colunas nao mapeadas serao usadas como features adicionais no modelo:"
Tags cinza: [regiao], [tipo_equipamento], [num_funcionarios]

Botao: "Confirmar e Processar" (primario azul, full width)

### Passo 3: Processamento
- Progress bar animada (Progress do shadcn), azul #293b83
- Textos sequenciais (mudam conforme avanca):
  - "Processando 482 registros..."
  - "Calculando health scores..."
  - "Rodando modelo de predicao..."
  - "Gerando explicacoes..."
- Ao concluir: card verde com icone CheckCircle:
  - "Processamento completo! **482 empresas** analisadas."
  - "34 em risco alto/critico identificadas."
  - Botao: "Ver predicoes →" (primario azul)

---

## Pagina 2: Upload Obtain (/obtain/upload)

Mesmo pattern visual do Upload Retain, mas com cor verde #10B981 e campos diferentes.

**Header:** "Upload de Dados" + badge "Obtain Sense" verde

**Area de upload:** Identica, mas hover muda para verde #10B981.

**Mapeamento para leads:**

| Campo | Coluna Sugerida | Status |
|-------|----------------|--------|
| Nome do contato | [nome] | ✅ |
| Email | [email] | ✅ |
| Empresa | [empresa] | ✅ |
| Setor | [setor_atuacao] | 💡 |
| Porte da empresa | [num_funcionarios] | 💡 |
| Cidade | [cidade] | 💡 |
| Estado | [uf] | 💡 |
| Campanha/Origem | [fonte] | 💡 |
| Status no funil | [etapa] | 💡 |
| Responsavel | — selecione — | ➖ |

Indicador: "8 de 10 campos mapeados"

**Ao concluir processamento:**
- "287 leads importados. **34 classificados como Hot**. 67 como Warm."
- Botao: "Ver lead scoring →" (verde #10B981)

---

## Pagina 3: Simulador ROI Obtain (/obtain/roi)

**Header:** "Simulador de ROI" + badge "Obtain Sense" verde. Subtitulo: "Calcule o retorno do investimento em inteligencia de aquisicao"

**Layout: 2 colunas**

### Coluna esquerda — Inputs
Card branco com titulo "Configure sua simulacao":
- Slider: Volume de leads/mes (50–2000, default 250)
- Slider: Taxa de conversao atual (5%–50%, default 24%)
- Slider: CAC atual (R$ 500–R$ 20.000, default R$ 5.200)
- Slider: LTV medio atual (R$ 50k–R$ 2M, default R$ 540.000)
- Slider: Investimento mensal marketing (R$ 10k–R$ 500k, default R$ 120.000)
- Botao "Calcular ROI" (verde #10B981, full width)

Sliders com thumb verde #10B981.

### Coluna direita — 3 cenarios

**Conservador (-15% CAC, +10% conversao, +10% LTV):**
- Economia anual CAC: **R$ 112K**
- Receita adicional (novos x LTV): **R$ 1.4M**
- ROI: **820%**
- Payback: **2 meses**

**Esperado (DESTAQUE, borda verde gradiente):**
- Badge "Recomendado"
- Economia anual CAC: **R$ 187K**
- Receita adicional: **R$ 2.8M**
- ROI: **1.540%**
- Payback: **1 mes**

**Otimista:**
- Economia anual CAC: **R$ 262K**
- Receita adicional: **R$ 4.5M**
- ROI: **2.480%**
- Payback: **< 1 mes**

**Destaque final:**
- "Com o Obtain Sense, voce pode gerar ate **R$ 2.8M em receita adicional** por ano"
- Botao CTA verde gradiente: "Solicitar demonstracao personalizada"

---

## Pagina 4: Configuracoes (/settings)

**Header:** "Configuracoes" (sem badge de modulo)

### Tabs (shadcn/ui Tabs): Perfil | Empresa | Setor | Usuarios

**Tab Perfil:**
Card com:
- Avatar circular grande (80px) com iniciais "CF" e fundo gradiente azul-teal
- Input: Nome completo (valor: "Caio Ferreira")
- Input: Email (valor: "caio@brintell.com")
- Input: Senha atual + Input: Nova senha
- Botao: "Salvar alteracoes"

**Tab Empresa:**
- Input: Nome da empresa (valor: "DCCO Distribuicao")
- Input: CNPJ (valor: "12.345.678/0001-90")
- Input: Endereco (valor: "Goiania, GO")
- Badge: Plano "Premium" (fundo gradiente azul-teal, texto branco)
- Botao: "Salvar"

**Tab Setor (MAIS IMPORTANTE):**
Titulo: "Configuracao do Setor" + subtitulo "Define a terminologia usada em toda a plataforma"

- Select: "Setor da empresa" com opcoes: Industrial B2B (selecionado), Telecom, Fintech, SaaS, Saude, Educacao, Varejo, Personalizado
  - Ao mudar o select, os campos abaixo atualizam automaticamente

- Input: "Label para cliente" → valor: "Empresa"
- Input: "Label para receita" → valor: "Valor do Contrato"
- Input: "Label para engajamento" → valor: "Utilizacao de Equipamentos"
- Input: "Label para suporte" → valor: "Chamados Tecnicos"
- Input: "Label para tenure" → valor: "Tempo de Parceria"
- Tags editaveis: "Segmentos" → Mineracao, Construcao Civil, Agropecuaria, Industrial (com X para remover e + para adicionar)
- Select: "Moeda" → BRL (opcoes: BRL, USD, EUR)

**Preview em tempo real (card ao lado ou abaixo):**
Card com titulo "Preview da Terminologia":
- Mini exemplo de como aparece no dashboard:
  - "482 **Empresas** ativas"
  - "**Valor do Contrato** medio: R$ 45.000"
  - "Segmentos: Mineracao, Construcao Civil, Agropecuaria, Industrial"
- Texto: "Estes termos serao usados em todos os dashboards e relatorios"

Botao: "Salvar Configuracao" (primario)

**Tab Usuarios:**
- Tabela: Nome, Email, Funcao (badge: Admin/Operador/Visualizador), Status (Ativo/Inativo), Data cadastro
- 3 linhas mock:
  - Caio Ferreira | caio@brintell.com | Admin | Ativo | 01/01/2026
  - Ana Silva | ana@dcco.com.br | Operador | Ativo | 15/02/2026
  - Pedro Santos | pedro@dcco.com.br | Visualizador | Ativo | 01/03/2026
- Botao: "Convidar usuario" (outline, abre dialog com campos nome + email + select funcao)
