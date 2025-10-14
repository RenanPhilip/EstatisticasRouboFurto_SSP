# 🔧 Comandos Úteis - SSP Analytics

## 📦 Setup e Instalação

```bash
# Instalar dependências
cd scripts && npm install && cd ..

# Verificar versões
node --version  # Deve ser v18+
npm --version
git --version

# Criar estrutura de pastas
mkdir -p .github/workflows scripts/temp data
```

---

## 🧪 Testes Locais

```bash
# Teste completo
cd scripts
node test-local.js

# Processamento real
node update-data.js

# Com mais memória
node --max-old-space-size=8192 update-data.js

# Ver logs em arquivo
node update-data.js > ../logs.txt 2>&1
```

---

## 📊 Verificar Dados

```bash
# Ver tamanho dos arquivos
ls -lh data/

# Ver primeiras linhas do JSON
head -n 50 data/estatisticas.json

# Contar registros no mapa
wc -l data/mapa-ocorrencias.json

# Ver estado de processamento
cat data/processing-state.json | jq '.'  # Se tiver jq instalado
# Ou:
cat data/processing-state.json

# Validar JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('data/estatisticas.json')))"
```

---

## 🔄 Git e GitHub

```bash
# Status
git status

# Adicionar arquivos
git add .

# Commit
git commit -m "Descrição da mudança"

# Push
git push

# Ver histórico
git log --oneline -10

# Desfazer último commit (mantém arquivos)
git reset --soft HEAD~1

# Ver diferenças
git diff

# Ver branches
git branch -a

# Limpar cache do Git
git rm -r --cached .
git add .
git commit -m "Limpar cache"
```

---

## 🗑️ Limpeza e Reset

```bash
# Limpar node_modules
cd scripts
rm -rf node_modules package-lock.json
npm install
cd ..

# Resetar estado (reprocessar tudo)
rm data/processing-state.json

# Limpar dados gerados
rm data/*.json

# Limpar arquivos temporários
rm -rf scripts/temp/*

# Manter estrutura de pastas
touch scripts/temp/.gitkeep
touch data/.gitkeep
```

---

## 📈 Análise de Dados

```bash
# Contar meses processados
cat data/processing-state.json | grep -o '"20[0-9][0-9]-[0-9][0-9]"' | wc -l

# Ver total de registros
cat data/estatisticas.json | grep '"totalRegistros"'

# Top 5 municípios
cat data/estatisticas.json | grep -A 5 '"porMunicipio"'

# Ver última atualização
cat data/estatisticas.json | grep '"ultimaAtualizacao"'

# Tamanho total dos dados
du -sh data/
```

---

## 🌐 Servidor Local

```bash
# Instalar servidor HTTP simples
npm install -g http-server

# Executar na raiz do projeto
http-server -p 8000

# Ou com Python
python -m http.server 8000

# Ou com Node
npx serve

# Acessar: http://localhost:8000
```

---

## 🐛 Debug

```bash
# Ver erros do Node
node --trace-warnings update-data.js

# Aumentar memória
node --max-old-space-size=8192 update-data.js

# Ver uso de memória em tempo real
node --expose-gc update-data.js

# Perfil de performance
node --prof update-data.js
node --prof-process isolate-*.log

# Debug mode
node --inspect update-data.js
# Abrir chrome://inspect
```

---

## 📦 NPM

```bash
# Ver dependências instaladas
cd scripts && npm list

# Atualizar dependências
npm update

# Ver pacotes desatualizados
npm outdated

# Verificar vulnerabilidades
npm audit

# Corrigir vulnerabilidades
npm audit fix

# Reinstalar tudo
rm -rf node_modules package-lock.json
npm install

# Ver scripts disponíveis
npm run
```

---

## 🔍 Buscar e Encontrar

```bash
# Encontrar arquivos
find . -name "*.json"
find . -name "*.js"

# Buscar texto em arquivos
grep -r "RUBRICA" .
grep -r "erro" scripts/

# Contar linhas de código
find . -name "*.js" -not -path "./node_modules/*" | xargs wc -l

# Tamanho de pastas
du -sh */
```

---

## 📝 Edição Rápida

```bash
# Ver arquivo no terminal
cat data/estatisticas.json

# Editar com nano
nano scripts/update-data.js

# Editar com vim
vim scripts/update-data.js

# Abrir no VS Code
code .
```

---

## 🔐 Permissões

```bash
# Dar permissão de execução
chmod +x scripts/update-data.js

# Ver permissões
ls -la

# Mudar dono (se necessário)
chown -R $USER:$USER .
```

---

## 🌍 GitHub Actions

```bash
# Ver workflows
ls .github/workflows/

# Validar sintaxe YAML
yamllint .github/workflows/update-data.yml

# Ou online:
# https://www.yamllint.com/
```

---

## 📊 GitHub CLI (se instalado)

```bash
# Instalar GitHub CLI
# https://cli.github.com/

# Login
gh auth login

# Ver workflows
gh workflow list

# Executar workflow
gh workflow run "Atualizar Dados SSP-SP"

# Ver status
gh run list

# Ver logs
gh run view --log

# Criar issue
gh issue create
```

---

## 🎨 Customizações

```bash
# Testar com arquivo específico
node update-data.js --ano=2024

# Processar apenas um mês (adicionar suporte)
node update-data.js --mes=10 --ano=2024

# Gerar apenas estatísticas
node update-data.js --only-stats

# Modo verbose
DEBUG=* node update-data.js
```

---

## 📦 Backup

```bash
# Backup dos dados
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Restaurar backup
tar -xzf backup-20251014.tar.gz

# Backup específico
cp data/estatisticas.json data/estatisticas-backup-$(date +%Y%m%d).json

# Backup do repositório inteiro
cd ..
tar -czf repo-backup-$(date +%Y%m%d).tar.gz EstatisticasRouboFurto_SSP/
```

---

## 🔄 Atualização Forçada

```bash
# Forçar reprocessamento de tudo
rm data/processing-state.json
node update-data.js

# Forçar apenas mês atual
# (Editar temporariamente o state.json)
node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('data/processing-state.json'));
delete state.mesesProcessados['2025-10'];
fs.writeFileSync('data/processing-state.json', JSON.stringify(state, null, 2));
"
node update-data.js
```

---

## 📈 Monitoramento

```bash
# Ver uso de CPU e memória
top
# Ou:
htop

# Ver processos Node
ps aux | grep node

# Matar processo se travado
killall node

# Ver espaço em disco
df -h

# Ver arquivos grandes
du -ah | sort -rh | head -20
```

---

## 🚀 Deploy e Produção

```bash
# Build para produção (se necessário)
npm run build

# Testar antes de commitar
npm test
node test-local.js
node update-data.js

# Commit e deploy
git add .
git commit -m "🚀 Deploy: $(date)"
git push

# Tag de versão
git tag -a v1.0.0 -m "Versão 1.0.0"
git push --tags
```

---

## 🔧 Troubleshooting Específico

```bash
# Erro: "Cannot find module"
cd scripts && npm install && cd ..

# Erro: "ENOSPC: no space left"
du -sh /* | sort -rh | head -10  # Encontrar o que está ocupando espaço
rm -rf node_modules  # Limpar node_modules

# Erro: "ECONNRESET" ou timeout
# Aumentar timeout no código ou tentar novamente

# Erro: "JavaScript heap out of memory"
node --max-old-space-size=8192 update-data.js

# GitHub Pages não atualiza
# Force refresh: Ctrl+Shift+R
# Ou aguarde 2-3 minutos
```

---

## 🎓 Comandos Avançados

```bash
# Watch mode (reexecuta ao salvar)
npx nodemon scripts/update-data.js

# Executar em background
nohup node scripts/update-data.js > logs.txt 2>&1 &

# Ver processo em background
jobs
ps aux | grep node

# Trazer para foreground
fg %1

# Executar com cron local (teste)
# Editar crontab:
crontab -e
# Adicionar:
# 0 3 * * * cd /caminho/para/projeto && node scripts/update-data.js

# Ver logs do cron
grep CRON /var/log/syslog
```

---

## 📚 Documentação Rápida

```bash
# Ver ajuda do Node
node --help

# Ver ajuda do NPM
npm help

# Ver ajuda do Git
git --help

# Abrir documentação
# Node: https://nodejs.org/docs/
# NPM: https://docs.npmjs.com/
# Git: https://git-scm.com/doc
```

---

## 🎯 Checklist Pré-Deploy

```bash
# Executar todos antes de dar push
✅ npm install
✅ node test-local.js
✅ node update-data.js
✅ git status
✅ ls -lh data/
✅ cat data/processing-state.json
✅ git add .
✅ git commit -m "Mensagem"
✅ git push
```

---

## 💡 Dicas Úteis

```bash
# Alias úteis (adicionar no ~/.bashrc ou ~/.zshrc)
alias test-ssp='cd scripts && node test-local.js'
alias update-ssp='cd scripts && node update-data.js'
alias check-data='ls -lh data/ && cat data/processing-state.json'
alias serve-local='http-server -p 8000'

# Recarregar aliases
source ~/.bashrc  # ou source ~/.zshrc
```

---

Salve este arquivo como referência rápida! 📚✨