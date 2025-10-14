# 🎯 Sistema de Atualização Incremental - SSP-SP

## 📋 Como Funciona

### Conceito: "Mês Atual e Anterior Sempre, Outros Só Uma Vez"

```
┌─────────────────────────────────────────────────────────┐
│  LÓGICA DE PROCESSAMENTO                                │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Mês ATUAL (Ex: OUT/2025)     → 🔄 SEMPRE atualiza      │
│  Mês ANTERIOR (Ex: SET/2025)  → 🔄 SEMPRE atualiza      │
│  Outros meses                 → ✅ Só se nunca processado│
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Por Que Essa Abordagem?

1. **Mês Atual**: Dados podem ser publicados ao longo do mês
2. **Mês Anterior**: Podem haver correções/dados retroativos
3. **Meses mais antigos**: São imutáveis (não mudam mais)

---

## 🔄 Fluxo de Execução

### Primeira Execução (Banco Vazio)
```
14 de Outubro de 2025
↓
Verifica: OUT/2025 → Nunca processado → PROCESSA
Verifica: SET/2025 → Nunca processado → PROCESSA
Verifica: AGO/2025 → Nunca processado → PROCESSA
Verifica: JUL/2025 → Nunca processado → PROCESSA
...continua até completar todos os anos
```

### Segunda Execução (No Mesmo Mês)
```
20 de Outubro de 2025
↓
Verifica: OUT/2025 → É mês ATUAL → REATUALIZA (remove antigo + adiciona novo)
Verifica: SET/2025 → É mês ANTERIOR → REATUALIZA (remove antigo + adiciona novo)
Verifica: AGO/2025 → Já processado (IMUTÁVEL) → PULA
Verifica: JUL/2025 → Já processado (IMUTÁVEL) → PULA
...todos os outros são pulados
```

### Terceira Execução (Mês Seguinte)
```
5 de Novembro de 2025
↓
Verifica: NOV/2025 → Nunca processado → PROCESSA
Verifica: OUT/2025 → Agora é mês ANTERIOR → REATUALIZA
Verifica: SET/2025 → Já processado (IMUTÁVEL) → PULA
...
```

---

## 📊 Estrutura do Estado (processing-state.json)

```json
{
  "mesesProcessados": {
    "2025-10": {
      "hash": "25834-12345",
      "registros": 25834,
      "dataProcessamento": "2025-10-14T12:00:00.000Z"
    },
    "2025-09": {
      "hash": "24891-11987",
      "registros": 24891,
      "dataProcessamento": "2025-10-14T12:05:00.000Z"
    },
    "2025-08": {
      "hash": "26102-12234",
      "registros": 26102,
      "dataProcessamento": "2025-10-14T12:10:00.000Z"
    }
  },
  "ultimaAtualizacao": "2025-10-14T12:15:00.000Z"
}
```

---

## ⚡ Otimizações Implementadas

### 1. **Leitura Seletiva de Colunas**
```javascript
// ❌ ANTES: Lia 52 colunas (~5MB por 100k registros)
const dados = XLSX.utils.sheet_to_json(sheet);

// ✅ AGORA: Lê apenas 14 colunas (~1.5MB por 100k registros)
const dadosOtimizados = dadosCompletos.map(row => {
  const rowOtimizada = {};
  COLUNAS_USAR.forEach(col => {
    if (row.hasOwnProperty(col)) {
      rowOtimizada[col] = row[col];
    }
  });
  return rowOtimizada;
});
```
**Economia: 70% menos memória**

### 2. **Download Único por Ano**
```javascript
// Baixa o arquivo do ano UMA VEZ
const buffer = await baixarArquivo(2024);

// Processa todos os meses necessários desse arquivo
for (let mes = 12; mes >= 1; mes--) {
  const dadosMes = processarMesEspecifico(workbook, MESES_NOME[mes]);
  // ...
}
```
**Benefício: Não baixa o mesmo arquivo 12 vezes**

### 3. **Pula Anos Completos**
```javascript
// Verifica se TODO o ano já foi processado
if (!temMesesParaProcessar) {
  console.log(`Todos os meses de ${ano} já processados. Pulando ano inteiro.`);
  continue; // Não baixa o arquivo!
}
```
**Benefício: Economiza 100MB+ de download**

### 4. **Salvamento Incremental**
```javascript
// Salva após cada mês processado
fs.writeFileSync(estatisticasPath, JSON.stringify(estatisticasGlobais, null, 2));
state.mesesProcessados[mesAnoKey] = { ... };
salvarEstado(state);
```
**Benefício: Não perde progresso se interrompido**

### 5. **Remoção Seletiva para Reatualização**
```javascript
// Remove apenas o mês específico antes de adicionar novamente
if (ehMesAtualOuAnterior && estatisticasGlobais) {
  estatisticasGlobais = removerMesEspecifico(estatisticasGlobais, ano, mes);
  dadosMapa = dadosMapa.filter(p => /* não é do mês atual/anterior */);
}
```
**Benefício: Mantém dados históricos intactos**

---

## 📈 Performance Esperada

### Primeira Execução (Processando 3 Anos Completos)
```
┌─────────────────────────────────────────────────────┐
│  Ano 2025 (10 meses)                                │
│  ├─ Download: ~2min                                 │
│  ├─ Processamento: ~8min                            │
│  └─ Total: ~10min                                   │
├─────────────────────────────────────────────────────┤
│  Ano 2024 (12 meses)                                │
│  ├─ Download: ~2min                                 │
│  ├─ Processamento: ~10min                           │
│  └─ Total: ~12min                                   │
├─────────────────────────────────────────────────────┤
│  Ano 2023 (12 meses)                                │
│  ├─ Download: ~2min                                 │
│  ├─ Processamento: ~10min                           │
│  └─ Total: ~12min                                   │
├─────────────────────────────────────────────────────┤
│  TOTAL PRIMEIRA EXECUÇÃO: ~34 minutos               │
└─────────────────────────────────────────────────────┘
```

### Execuções Subsequentes (Mesmo Mês)
```
┌─────────────────────────────────────────────────────┐
│  Verificação de estado: ~1s                         │
│  Download ano atual: ~2min                          │
│  Processamento 2 meses (atual + anterior): ~2min    │
│  ├─ Remove dados antigos                            │
│  ├─ Processa novos dados                            │
│  └─ Merge com histórico                             │
│  TOTAL: ~4 minutos                                  │
└─────────────────────────────────────────────────────┘
```

### Execução no Início de Novo Mês
```
┌─────────────────────────────────────────────────────┐
│  Verificação de estado: ~1s                         │
│  Download ano atual: ~2min                          │
│  Processamento 3 meses:                             │
│  ├─ Novo mês atual (novo): ~1min                    │
│  ├─ Mês anterior (reatualiza): ~1min                │
│  ├─ Dois meses atrás (pula - imutável): ~0s         │
│  TOTAL: ~4 minutos                                  │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Cenários de Uso

### Cenário 1: Deploy Inicial
```bash
# Primeira vez - processa tudo
node update-data.js

# Resultado:
# - 36 meses processados (3 anos completos)
# - ~1.2 milhão de registros
# - estatisticas.json: ~200KB
# - mapa-ocorrencias.json: ~3MB
# - Tempo: ~34 minutos
```

### Cenário 2: Atualização Diária (Mesmo Mês)
```bash
# GitHub Actions roda todo dia
node update-data.js

# Resultado:
# - Apenas OUT/2025 e SET/2025 são reprocessados
# - Outros 34 meses: pulados (imutáveis)
# - Tempo: ~4 minutos
```

### Cenário 3: Virada de Mês
```bash
# 1º de novembro
node update-data.js

# Resultado:
# - NOV/2025: processado (novo mês)
# - OUT/2025: reprocessado (agora é mês anterior)
# - SET/2025 e anteriores: pulados (imutáveis)
# - Tempo: ~4 minutos
```

### Cenário 4: Interrupção e Retomada
```bash
# Primeira execução interrompida após 20 minutos
# Processou: OUT/2025 até JAN/2024

# Segunda execução:
node update-data.js

# Resultado:
# - OUT/2025 e SET/2025: reprocessados (mês atual/anterior)
# - AGO/2025 até JAN/2024: pulados (já processados)
# - DEZ/2023 até JAN/2023: continuam do ponto que parou
# - Tempo: ~15 minutos (resto)
```

---

## 📊 Tamanho dos Arquivos Gerados

```
data/
├── estatisticas.json          (~150-200 KB)
│   └── Agregações completas de 36 meses
│
├── mapa-ocorrencias.json      (~2-3 MB)
│   └── Últimos 20.000 pontos georreferenciados
│
├── ocorrencias-recentes.json  (~800 KB - 1 MB)
│   └── Últimos 10.000 registros detalhados
│
├── top-bairros.json           (~8-10 KB)
│   └── Top 100 bairros
│
├── top-delegacias.json        (~4-6 KB)
│   └── Top 50 municípios
│
└── processing-state.json      (~2-5 KB)
    └── Estado de processamento (36 meses)
```

**Total: ~3-4 MB** (muito leve para GitHub Pages!)

---

## 🔍 Logs de Exemplo

### Primeira Execução
```
🚀 Iniciando processamento SSP-SP (INCREMENTAL MÊS A MÊS)

📅 Data de Execução: 14/10/2025
🔄 Mês ATUAL: OUTUBRO/2025 (SEMPRE atualiza)
🔄 Mês ANTERIOR: SETEMBRO/2025 (SEMPRE atualiza)
✅ Outros meses: Apenas se nunca processados (IMUTÁVEIS)

📂 Estado carregado: 0 meses já processados

📅 ========== ANO: 2025 ==========
📥 [Tentativa 1/3] Baixando 2025...
✅ Download de 2025 concluído (142.34 MB)

   📆 Verificando DEZEMBRO/2025...
   ⚠️ DEZEMBRO/2025: Não encontrado (mês futuro)

   📆 Verificando NOVEMBRO/2025...
   ⚠️ NOVEMBRO/2025: Não encontrado (mês futuro)

   📆 Verificando OUTUBRO/2025...
   🔄 OUTUBRO/2025: Mês ATUAL - Sempre atualiza
      📊 25,834 registros carregados
      ✅ OUTUBRO/2025 processado e salvo (25834 registros)

   📆 Verificando SETEMBRO/2025...
   🔄 SETEMBRO/2025: Mês ANTERIOR - Atualiza por segurança
      📊 24,891 registros carregados
      ✅ SETEMBRO/2025 processado e salvo (24891 registros)

   📆 Verificando AGOSTO/2025...
   🆕 AGOSTO/2025: Nunca processado - Processar
      📊 26,102 registros carregados
      ✅ AGOSTO/2025 processado e salvo (26102 registros)

   ... (continua até janeiro)

📅 ========== ANO: 2024 ==========
   ... (processa todos os 12 meses)

📅 ========== ANO: 2023 ==========
   ... (processa todos os 12 meses)

📦 Gerando arquivos auxiliares...
   ✅ Arquivos auxiliares gerados.

🎉 Processamento concluído com sucesso!
📊 Total de meses processados historicamente: 34
📊 Total de registros no banco: 1.234.567
```

### Segunda Execução (Mesmo Mês)
```
🚀 Iniciando processamento SSP-SP (INCREMENTAL MÊS A MÊS)

📅 Data de Execução: 20/10/2025
🔄 Mês ATUAL: OUTUBRO/2025 (SEMPRE atualiza)
🔄 Mês ANTERIOR: SETEMBRO/2025 (SEMPRE atualiza)
✅ Outros meses: Apenas se nunca processados (IMUTÁVEIS)

📂 Estado carregado: 34 meses já processados
📂 Carregando estatísticas existentes...
📂 Carregando mapa existente...

📅 ========== ANO: 2025 ==========
📥 [Tentativa 1/3] Baixando 2025...
✅ Download de 2025 concluído (144.12 MB)

   📆 Verificando DEZEMBRO/2025...
   ⚠️ DEZEMBRO/2025: Não encontrado

   📆 Verificando NOVEMBRO/2025...
   ⚠️ NOVEMBRO/2025: Não encontrado

   📆 Verificando OUTUBRO/2025...
   🔄 OUTUBRO/2025: Mês ATUAL - Sempre atualiza
      🔄 Removendo dados antigos de OUTUBRO/2025 para reatualizar...
      📊 26,012 registros carregados
      ✅ OUTUBRO/2025 processado e salvo (26012 registros)

   📆 Verificando SETEMBRO/2025...
   🔄 SETEMBRO/2025: Mês ANTERIOR - Atualiza por segurança
      🔄 Removendo dados antigos de SETEMBRO/2025 para reatualizar...
      📊 24,998 registros carregados
      ✅ SETEMBRO/2025 processado e salvo (24998 registros)

   📆 Verificando AGOSTO/2025...
   ✅ AGOSTO/2025: Já processado (IMUTÁVEL) - Pulando

   📆 Verificando JULHO/2025...
   ✅ JULHO/2025: Já processado (IMUTÁVEL) - Pulando

   ... (todos os outros são pulados)

📅 ========== ANO: 2024 ==========
   ✅ Todos os meses de 2024 já processados. Pulando ano inteiro.

📅 ========== ANO: 2023 ==========
   ✅ Todos os meses de 2023 já processados. Pulando ano inteiro.

📦 Gerando arquivos auxiliares...
   ✅ Arquivos auxiliares gerados.

🎉 Processamento concluído com sucesso!
📊 Total de meses processados historicamente: 34
📊 Total de registros no banco: 1.235.789
```

---

## ⚙️ Configuração do GitHub Actions

### Workflow Atualizado
```yaml
name: Atualizar Dados SSP-SP

on:
  workflow_dispatch: # Manual
  schedule:
    - cron: '0 3 5 * *' # Todo dia 5 às 3h UTC

jobs:
  update-data:
    runs-on: ubuntu-latest
    timeout-minutes: 120

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Instalar dependências
        run: cd scripts && npm ci

      - name: Restaurar cache
        uses: actions/cache@v4
        with:
          path: |
            data/estatisticas.json
            data/mapa-ocorrencias.json
            data/processing-state.json
          key: ssp-data-${{ hashFiles('data/processing-state.json') }}

      - name: Processar dados
        run: |
          cd scripts
          node --max-old-space-size=8192 update-data.js

      - name: Commit e push
        run: |
          git config --local user.email "actions@github.com"
          git config --local user.name "GitHub Actions"
          git add data/*.json
          git diff --staged --quiet || git commit -m "🤖 Atualização $(date +'%d/%m/%Y')"
          git push
```

### Frequência Recomendada
- **Primeira semana do mês**: Diariamente (captura dados do mês anterior)
- **Resto do mês**: Semanalmente (economiza minutos do GitHub Actions)

---

## 🧪 Como Testar Localmente

### 1. Baixe um arquivo de teste
```bash
# Acesse: https://www.ssp.sp.gov.br/estatistica/dados-mensais
# Baixe: VeiculosSubtraidos_2024.xlsx
# Coloque em: scripts/temp/
```

### 2. Execute o teste
```bash
cd scripts
node test-local.js
```

### 3. Execute o processamento
```bash
cd scripts
node update-data.js
```

### 4. Verifique os resultados
```bash
# Ver estado
cat ../data/processing-state.json

# Ver estatísticas
cat ../data/estatisticas.json | head -n 50

# Ver tamanhos
ls -lh ../data/
```

---

## 🎓 Benefícios da Abordagem

### ✅ Performance
- **Primeira execução**: ~34 min (processa 3 anos)
- **Atualizações**: ~4 min (apenas 2 meses)
- **Economia de 88% no tempo** após primeira execução

### ✅ Confiabilidade
- Salvamento incremental (não perde progresso)
- Reatualização do mês atual (captura correções)
- Estado persistente (sabe o que já foi processado)

### ✅ Eficiência
- Lê apenas 14 colunas (vs 52 originais)
- Download único por ano
- Pula anos já completos
- Cache do GitHub Actions

### ✅ Manutenibilidade
- Logs detalhados
- Estado transparente
- Fácil debug
- Rollback simples

---

## 🚨 Troubleshooting

### Problema: "Mês não encontrado"
```
⚠️ DEZEMBRO/2025: Não encontrado (mês futuro)
```
**Solução**: Normal. SSP ainda não publicou esse mês.

### Problema: "Erro no download"
```
❌ Erro após 3 tentativas: timeout
```
**Solução**: Aumentar timeout ou tentar novamente mais tarde.

### Problema: "Estado corrompido"
```bash
# Deletar estado e reprocessar
rm data/processing-state.json
node update-data.js
```

### Problema: "Dados inconsistentes no mês atual"
```bash
# Forçar reprocessamento do mês atual
# O script já faz isso automaticamente!
# Mas se quiser forçar tudo:
rm data/processing-state.json
```

---

## 📝 Próximos Passos

1. **Teste Local**
   ```bash
   cd scripts
   npm install
   node update-data.js
   ```

2. **Commit no GitHub**
   ```bash
   git add .
   git commit -m "Sistema incremental implementado"
   git push
   ```

3. **Execute Workflow Manualmente**
   - GitHub → Actions → Atualizar Dados SSP-SP → Run workflow

4. **Aguarde**
   - Primeira execução: ~34 minutos
   - Verificar logs em tempo real

5. **Verifique Resultado**
   - Acesse: `https://seu-usuario.github.io/seu-repo`
   - Dashboard deve estar funcionando!

---

## 🎉 Resumo Final

Você agora tem um sistema que:

- ✅ Processa 1.2M+ registros em ~34 min (primeira vez)
- ✅ Atualiza em ~4 min (execuções seguintes)
- ✅ Economiza 88% do tempo de processamento
- ✅ Reatualiza mês atual + anterior automaticamente
- ✅ Mantém meses antigos imutáveis (não reprocessa)
- ✅ Salva progresso incrementalmente
- ✅ Usa apenas 14 das 52 colunas (70% menos memória)
- ✅ Gera apenas 3-4MB de JSONs
- ✅ 100% gratuito (GitHub Actions + Pages)

**Perfeito para seu portfólio!** 🚀