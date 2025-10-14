# 🚀 Guia Rápido de Deploy

## ✅ Checklist Pré-Deploy

```
[ ] Node.js instalado (v18+)
[ ] Git configurado
[ ] Conta no GitHub
[ ] Repositório criado
```

---

## 📋 Passo a Passo

### 1️⃣ Preparar Ambiente Local

```bash
# Clone ou navegue até seu projeto
cd seu-projeto

# Instalar dependências
cd scripts
npm install
cd ..
```

### 2️⃣ Testar Localmente (IMPORTANTE!)

```bash
# Baixe um arquivo de teste da SSP-SP
# URL: https://www.ssp.sp.gov.br/estatistica/dados-mensais
# Salve como: scripts/temp/VeiculosSubtraidos_2024.xlsx

# Execute o teste
cd scripts
node test-local.js
```

**Resultado esperado:**
```
✅ Arquivo carregado com sucesso!
📄 Abas encontradas (12): JANEIRO, FEVEREIRO, ...
🔍 SIMULANDO PROCESSAMENTO INCREMENTAL:
   ...
✅ TESTE CONCLUÍDO COM SUCESSO!
```

### 3️⃣ Executar Processamento Real (Opcional Local)

```bash
# Ainda em scripts/
node update-data.js
```

**O que vai acontecer:**
- ✅ Baixa dados de 2025, 2024, 2023
- ✅ Processa apenas meses necessários
- ✅ Gera JSONs em ../data/
- ⏱️ Tempo: ~34 minutos (primeira vez)

### 4️⃣ Preparar para GitHub

```bash
# Voltar para raiz do projeto
cd ..

# Inicializar Git (se ainda não fez)
git init

# Adicionar todos os arquivos
git add .

# Commit
git commit -m "🚀 Sistema incremental de analytics SSP-SP"
```

### 5️⃣ Criar Repositório no GitHub

1. Vá em: https://github.com/new
2. Nome: `EstatisticasRouboFurto_SSP` (ou outro nome)
3. Descrição: `Dashboard de Analytics - Roubos e Furtos SP`
4. Público
5. **NÃO** adicione README, .gitignore ou license
6. Clique em **Create repository**

### 6️⃣ Conectar e Enviar

```bash
# Adicionar remote (substitua SEU-USUARIO e SEU-REPO)
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git

# Renomear branch para main
git branch -M main

# Enviar pela primeira vez
git push -u origin main
```

### 7️⃣ Configurar GitHub Pages

1. Vá em: `https://github.com/SEU-USUARIO/SEU-REPO/settings/pages`
2. **Source**: Deploy from a branch
3. **Branch**: `main` / `/ (root)`
4. Clique em **Save**
5. Aguarde ~2 minutos

**Seu site estará em:**
```
https://SEU-USUARIO.github.io/SEU-REPO
```

### 8️⃣ Configurar Permissões do GitHub Actions

1. Vá em: `https://github.com/SEU-USUARIO/SEU-REPO/settings/actions`
2. **Workflow permissions**: 
   - ✅ **Read and write permissions**
3. Clique em **Save**

### 9️⃣ Executar Workflow Manualmente (Primeira Vez)

1. Vá em: `https://github.com/SEU-USUARIO/SEU-REPO/actions`
2. Clique em **Atualizar Dados SSP-SP** (workflow à esquerda)
3. Clique em **Run workflow** (botão azul)
4. Selecione branch `main`
5. Clique em **Run workflow** (confirmar)

**O que vai acontecer:**
- ⏳ Execução inicia
- 📥 Baixa dados de 3 anos
- ⚙️ Processa ~34 minutos
- ✅ Commit automático dos JSONs
- 🌐 GitHub Pages atualiza automaticamente

### 🔟 Monitorar Execução

**Enquanto roda:**
```
Clique no workflow em execução
→ Clique em "update-data"
→ Veja os logs em tempo real
```

**Logs esperados:**
```
🚀 Iniciando processamento SSP-SP (INCREMENTAL MÊS A MÊS)
📅 Data de Execução: 14/10/2025
🔄 Mês ATUAL: OUTUBRO/2025 (SEMPRE atualiza)
🔄 Mês ANTERIOR: SETEMBRO/2025 (SEMPRE atualiza)
...
📅 ========== ANO: 2025 ==========
📥 [Tentativa 1/3] Baixando 2025...
✅ Download de 2025 concluído (142.34 MB)
   📆 Verificando OUTUBRO/2025...
   🔄 OUTUBRO/2025: Mês ATUAL - Sempre atualiza
      📊 25,834 registros carregados
      ✅ OUTUBRO/2025 processado e salvo
...
🎉 Processamento concluído com sucesso!
📊 Total de meses processados historicamente: 34
📊 Total de registros no banco: 1.234.567
```

---

## 🎯 Verificar se Funcionou

### ✅ Checklist Final

**1. Arquivos Gerados no Repositório:**
```bash
# No GitHub, verifique se existem:
data/estatisticas.json          (~200 KB)
data/mapa-ocorrencias.json      (~3 MB)
data/ocorrencias-recentes.json  (~1 MB)
data/top-bairros.json           (~10 KB)
data/top-delegacias.json        (~5 KB)
data/processing-state.json      (~3 KB)
```

**2. Site Acessível:**
```
Acesse: https://SEU-USUARIO.github.io/SEU-REPO
```

**Deve mostrar:**
- ✅ Cards com estatísticas preenchidos
- ✅ Gráficos renderizando
- ✅ Mapa com pontos
- ✅ Dados atualizados

**3. Estado de Processamento:**
```
Acesse: https://SEU-USUARIO.github.io/SEU-REPO/data/processing-state.json
```

**Deve mostrar:**
```json
{
  "mesesProcessados": {
    "2025-10": { "registros": 25834, ... },
    "2025-09": { "registros": 24891, ... },
    ...
  },
  "ultimaAtualizacao": "2025-10-14T..."
}
```

---

## 🔄 Próximas Execuções (Automáticas)

O workflow está configurado para rodar:
- 📅 **Todo dia 5 de cada mês às 3h UTC** (00h horário de Brasília)
- ⏱️ **Tempo: ~4 minutos** (apenas mês atual + anterior)

**O que acontece:**
1. Verifica estado
2. Baixa apenas ano atual
3. Processa apenas 2 meses (atual + anterior)
4. Merge com dados históricos
5. Commit automático
6. GitHub Pages atualiza

---

## 🛠️ Atualizações Manuais

### Forçar Atualização Agora

```bash
# No GitHub:
Actions → Atualizar Dados SSP-SP → Run workflow
```

### Resetar Estado (Reprocessar Tudo)

```bash
# Localmente:
cd data
rm processing-state.json
git add .
git commit -m "Reset estado - reprocessar tudo"
git push

# Ou via GitHub:
1. Vá em data/processing-state.json
2. Clique no ícone de lixeira (Delete)
3. Commit
4. Execute workflow manualmente
```

---

## 🐛 Troubleshooting

### Problema: "Workflow não aparece em Actions"

**Causa:** Arquivo do workflow não está em `.github/workflows/`

**Solução:**
```bash
# Verificar estrutura
ls -la .github/workflows/

# Deve mostrar:
update-data.yml
deploy.yml
```

### Problema: "Permission denied ao fazer commit"

**Causa:** Workflow permissions não configurado

**Solução:**
1. Settings → Actions → General
2. Workflow permissions: **Read and write**
3. Save

### Problema: "Site não atualiza após commit"

**Solução:**
```bash
# Force refresh no navegador
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R

# Ou limpe cache
F12 → Network → Disable cache
```

### Problema: "JSONs estão vazios"

**Causa:** Primeira execução ainda não rodou

**Solução:**
```bash
# Execute manualmente:
Actions → Run workflow

# Ou execute localmente e commite:
cd scripts
node update-data.js
cd ..
git add data/*.json
git commit -m "Dados iniciais"
git push
```

### Problema: "Timeout após 2 horas"

**Causa:** Primeira execução pode demorar

**Solução:**
```bash
# Processe localmente:
cd scripts
node update-data.js

# Commit os resultados:
cd ..
git add data/*.json
git commit -m "Processamento inicial local"
git push

# Próximas execuções serão rápidas (~4 min)
```

---

## 📊 Monitoramento

### Ver Estatísticas de Uso

```bash
# GitHub Actions usage:
Settings → Billing → Usage this month

# Minutes usados:
- Primeira execução: ~34 min
- Atualizações: ~4 min/mês
- Total/ano: ~82 minutos (limite gratuito: 2000 min/mês)
```

### Logs Detalhados

```bash
# Acessar logs de execução:
Actions → Workflow → View logs

# Download logs:
Actions → Workflow → ... → Download logs
```

---

## 🎨 Personalizações Futuras

### Mudar Frequência de Atualização

```yaml
# .github/workflows/update-data.yml

# De mensal para semanal:
schedule:
  - cron: '0 3 * * 0'  # Todo domingo

# Para diário:
schedule:
  - cron: '0 3 * * *'  # Todo dia
```

### Adicionar Notificações

```yaml
# No final do workflow:
- name: Notificar Sucesso
  if: success()
  run: |
    curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"✅ Dados SSP atualizados!"}' \
    SEU_WEBHOOK_URL
```

### Processar Mais Anos

```javascript
// scripts/update-data.js
// Linha ~8:
const ANOS = [anoAtual, anoAtual - 1, anoAtual - 2, anoAtual - 3]; // +1 ano
```

---

## ✅ Conclusão

Após seguir este guia, você terá:

- ✅ Dashboard funcionando
- ✅ Dados atualizados automaticamente
- ✅ Sistema incremental otimizado
- ✅ ~34 min primeira execução
- ✅ ~4 min atualizações mensais
- ✅ 100% gratuito
- ✅ Pronto para o portfólio!

---

## 📞 Suporte

Se tiver problemas:

1. **Verifique os logs** no GitHub Actions
2. **Teste localmente** com `node test-local.js`
3. **Valide colunas** no arquivo da SSP
4. **Confira permissões** do workflow
5. **Force refresh** no navegador

**Lembre-se:** A primeira execução demora ~34 min, mas é só uma vez! 🚀