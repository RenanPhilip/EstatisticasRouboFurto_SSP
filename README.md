# 📊 Dashboard de Roubos e Furtos de Veículos - SP

Visualização interativa dos dados oficiais de criminalidade da SSP-SP (Secretaria de Segurança Pública de São Paulo).

## 🚀 Como funciona

Este projeto usa **GitHub Actions** para baixar e processar automaticamente os dados da SSP-SP todo mês, e **GitHub Pages** para hospedar o site de visualização.

### Arquitetura

```
GitHub Actions (mensal) → Baixa dados SSP → Processa → Gera JSONs → Commit
                                                                        ↓
                                                              GitHub Pages → Site
```

## 📁 Estrutura do projeto

```
seu-repositorio/
├── .github/
│   └── workflows/
│       └── update-data.yml       # Automação mensal
├── scripts/
│   ├── update-data.js            # Script de download e processamento
│   └── package.json              # Dependências Node.js
├── data/
│   ├── roubos-veiculos.json      # Dados de roubos (gerado automaticamente)
│   ├── furtos-veiculos.json      # Dados de furtos (gerado automaticamente)
│   └── estatisticas.json         # Estatísticas agregadas (gerado automaticamente)
├── index.html                    # Página principal
├── app.js                        # JavaScript do frontend
└── README.md                     # Este arquivo
```

## 🛠️ Configuração

### 1. Criar o repositório no GitHub

```bash
git init
git add .
git commit -m "Primeiro commit"
git branch -M main
git remote add origin https://github.com/seu-usuario/seu-repositorio.git
git push -u origin main
```

### 2. Ativar GitHub Pages

1. Vá em **Settings** do repositório
2. Clique em **Pages** no menu lateral
3. Em **Source**, selecione `main` branch
4. Clique em **Save**
5. Seu site estará disponível em: `https://seu-usuario.github.io/seu-repositorio`

### 3. Configurar permissões do GitHub Actions

1. Vá em **Settings** → **Actions** → **General**
2. Em **Workflow permissions**, selecione:
   - ✅ **Read and write permissions**
3. Clique em **Save**

### 4. Testar manualmente (primeira vez)

1. Vá na aba **Actions** do seu repositório
2. Clique em **Atualizar Dados SSP-SP**
3. Clique em **Run workflow** → **Run workflow**
4. Aguarde o processo completar (pode levar alguns minutos)

## 🔧 Personalização

### Ajustar nomes das colunas

Os dados da SSP podem usar diferentes nomes de colunas. Se necessário, edite o arquivo `scripts/update-data.js` nas funções:

- `separarRoubosFurtos()` - identifica roubos vs furtos
- `extrairRegiao()` - extrai região/delegacia
- `extrairMunicipio()` - extrai município/cidade

### Mudar frequência de atualização

Edite `.github/workflows/update-data.yml`:

```yaml
schedule:
  - cron: '0 3 1 * *'  # Todo dia 1 às 3h
  # Exemplos:
  # - cron: '0 3 * * 0'   # Todo domingo às 3h
  # - cron: '0 3 15 * *'  # Todo dia 15 às 3h
```

## 🎨 Customizar o site

- **`index.html`** - Estrutura e layout
- **`app.js`** - Lógica e gráficos
- Adicione CSS personalizado no `<style>` do HTML

## 📊 Estrutura dos dados gerados

### `estatisticas.json`
```json
{
  "ultimaAtualizacao": "2025-10-12T...",
  "totalRoubos": 15420,
  "totalFurtos": 23890,
  "porAno": {
    "2025": { "roubos": 1200, "furtos": 1800 },
    "2024": { "roubos": 14220, "furtos": 22090 }
  },
  "porMunicipio": {
    "SÃO PAULO": { "roubos": 8500, "furtos": 12000 }
  },
  "porMesAno": {
    "Janeiro/2025": { "roubos": 120, "furtos": 180 }
  }
}
```

## 🐛 Solução de problemas

### GitHub Actions falha no download

O site da SSP pode mudar sua estrutura. Você precisará:

1. Inspecionar a página manualmente
2. Ajustar os seletores no arquivo `update-data.js`
3. Testar localmente antes de fazer commit

### Executar localmente para testes

```bash
cd scripts
npm install
node update-data.js
```

### Dados não aparecem no site

1. Verifique se os arquivos JSON foram gerados em `/data`
2. Abra o Console do navegador (F12) para ver erros
3. Confirme que o GitHub Pages está ativo

## 📝 Dados da SSP-SP

### Estrutura dos arquivos

- **Nome:** Veículos subtraídos - [ANO].xlsx
- **Abas:** Uma por mês (Janeiro, Fevereiro, etc.)
- **Colunas comuns:**
  - NATUREZA ou TIPO (Roubo, Furto)
  - MUNICÍPIO ou CIDADE
  - DELEGACIA ou SECCIONAL
  - Outras colunas específicas

### Fonte oficial

https://www.ssp.sp.gov.br/estatistica/dados-mensais

## 🚀 Deploy

O site é atualizado automaticamente quando:
- ✅ GitHub Actions roda mensalmente
- ✅ Você faz push de alterações
- ✅ Você executa manualmente o workflow

Acesse seu site em:
```
https://seu-usuario.github.io/seu-repositorio
```

## 📄 Licença

Use livremente! Os dados são públicos da SSP-SP.

---

**Dica:** Adicione um badge no README para mostrar status:

```markdown
![Atualização Dados](https://github.com/seu-usuario/seu-repo/actions/workflows/update-data.yml/badge.svg)
```