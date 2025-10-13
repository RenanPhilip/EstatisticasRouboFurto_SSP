# 🚀 Comandos Rápidos

## 📦 Setup Inicial

### 1. Criar estrutura de pastas (Windows PowerShell)
```powershell
mkdir .github\workflows
mkdir scripts\temp
mkdir data
New-Item -ItemType File -Path "scripts\temp\.gitkeep"
New-Item -ItemType File -Path "data\.gitkeep"
```

### 2. Instalar dependências
```powershell
cd scripts
npm install
```

### 3. Testar localmente (após baixar arquivo da SSP)
```powershell
node test-local.js
```

---

## 🔧 Git e GitHub

### Inicializar repositório
```bash
git init
git add .
git commit -m "Dashboard Analytics - Veículos Subtraídos SP"
```

### Conectar ao GitHub
```bash
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git branch -M main
git push -u origin main
```

### Atualizações futuras
```bash
git add .
git commit -m "Descrição da mudança"
git push
```

---

## 🧪 Desenvolvimento

### Testar processamento local
```powershell
cd scripts
node update-data.js
```

### Ver logs detalhados
```powershell
node test-local.js > logs.txt
```

### Limpar e reinstalar dependências
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

---

## 📊 Verificações

### Verificar estrutura de pastas
```powershell
tree /F
```

### Ver tamanho dos arquivos gerados
```powershell
dir data
```

### Testar se JSON está válido
```powershell
Get-Content data\estatisticas.json | ConvertFrom-Json
```

---

## 🌐 URLs Importantes

### Site da SSP-SP (baixar dados)
```
https://www.ssp.sp.gov.br/estatistica/dados-mensais
```

### Seu dashboard (após deploy)
```
https://SEU-USUARIO.github.io/SEU-REPO
```

### GitHub Actions (monitorar execução)
```
https://github.com/SEU-USUARIO/SEU-REPO/actions
```

### GitHub Pages (configurar)
```
https://github.com/SEU-USUARIO/SEU-REPO/settings/pages
```

---

## 🔍 Debugging

### Ver erros do GitHub Actions
1. Vá em: `https://github.com/SEU-USUARIO/SEU-REPO/actions`
2. Clique no workflow que falhou
3. Clique em "update-data"
4. Veja os logs detalhados

### Testar site localmente
```powershell
# Instale um servidor HTTP simples
npm install -g http-server

# Execute na raiz do projeto
http-server -p 8000

# Acesse: http://localhost:8000
```

---

## 📝 Comandos NPM Úteis

### Ver versões instaladas
```bash
npm list
```

### Atualizar dependências
```bash
npm update
```

### Verificar vulnerabilidades
```bash
npm audit
```

### Limpar cache do NPM
```bash
npm cache clean --force
```

---

## 🎯 Workflow GitHub Actions

### Executar manualmente
1. Vá em: Actions
2. Clique em "Atualizar Dados SSP-SP"
3. Clique em "Run workflow"
4. Selecione branch "main"
5. Clique em "Run workflow"

### Cancelar execução em andamento
1. Vá em: Actions
2. Clique no workflow em execução
3. Clique em "Cancel workflow"

---

## 🔄 Atualização Manual (sem GitHub Actions)

### Se o GitHub Actions não funcionar:

```powershell
# 1. Entre na pasta scripts
cd scripts

# 2. Baixe manualmente os arquivos da SSP e coloque em temp/

# 3. Execute o processamento
node update-data.js

# 4. Volte para raiz
cd ..

# 5. Commit os JSONs gerados
git add data/*.json
git commit -m "Atualização manual de dados"
git push
```

---

## 💾 Backup

### Fazer backup dos dados
```powershell
# Copiar pasta data
Copy-Item -Recurse data data_backup_$(Get-Date -Format "yyyyMMdd")
```

### Restaurar backup
```powershell
Remove-Item -Recurse data
Copy-Item -Recurse data_backup_YYYYMMDD data
```

---

## 🎨 Personalização

### Mudar cores do site
Edite `index.html`, seção `<style>`:
- `#0f172a` - Cor de fundo principal
- `#3b82f6` - Azul (acento)
- `#8b5cf6` - Roxo (acento)
- `#ec4899` - Rosa (acento)

### Adicionar novo gráfico
1. Adicione HTML em `index.html`:
```html
<div class="chart-container">
    <h2 class="chart-title">Meu Novo Gráfico</h2>
    <canvas id="meuGrafico"></canvas>
</div>
```

2. Adicione função em `app.js`:
```javascript
function criarMeuGrafico() {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    charts.meuGrafico = new Chart(ctx, {
        // configuração do gráfico
    });
}
```

3. Chame em `criarTodosGraficos()`:
```javascript
function criarTodosGraficos() {
    // ... outros gráficos
    criarMeuGrafico();
}
```

---

## 📱 Testar Responsividade

### Chrome DevTools
1. Pressione `F12`
2. Clique no ícone de celular (Toggle device toolbar)
3. Teste diferentes dispositivos

### Dimensões para testar
- Mobile: 375x667 (iPhone)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080

---

## 🚨 Solução de Problemas Comuns

### Erro: "Cannot find module"
```powershell
cd scripts
npm install
```

### Erro: "Permission denied" no Git
```bash
git config --global user.email "rphiliper@gmail.com"
git config --global user.name "Renan Ribeiro"
```

### Site não atualiza após push
1. Espere 1-2 minutos
2. Force refresh: `Ctrl + Shift + R` (Windows) ou `Cmd + Shift + R` (Mac)
3. Limpe cache do navegador

### Mapa não aparece
1. Verifique se `mapa-ocorrencias.json` foi gerado
2. Abra Console (F12) e veja erros
3. Verifique se há coordenadas válidas nos dados

### Gráficos não renderizam
1. Abra Console (F12)
2. Procure por erros JavaScript
3. Verifique se Chart.js foi carregado
4. Confirme que `estatisticas.json` existe

---

## 📖 Documentação de Referências

- **Chart.js**: https://www.chartjs.org/docs/
- **Leaflet**: https://leafletjs.com/reference.html
- **GitHub Actions**: https://docs.github.com/actions
- **GitHub Pages**: https://pages.github.com/
- **Node.js**: https://nodejs.org/docs/
- **XLSX**: https://docs.sheetjs.com/

---

## ✅ Checklist de Deploy

```
[ ] Testou localmente
[ ] Commitou todos os arquivos
[ ] GitHub Pages ativado
[ ] GitHub Actions configurado (Read/Write)
[ ] Executou workflow pela primeira vez
[ ] JSONs gerados em /data
[ ] Site acessível
[ ] Gráficos funcionando
[ ] Mapa funcionando
[ ] Responsivo em mobile
```

---

## 🎓 Para Aprender Mais

### Melhorar visualizações
- D3.js para gráficos avançados
- Plotly para gráficos 3D
- Mapbox para mapas profissionais

### Melhorar performance
- Lazy loading de imagens
- Service Workers (PWA)
- Compressão GZIP
- CDN para assets

### Adicionar features
- Autenticação (GitHub OAuth)
- Banco de dados (Firebase)
- API própria (Vercel Functions)
- Notificações (Push API)

---

Boa sorte com seu projeto! 🚀