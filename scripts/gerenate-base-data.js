// scripts/generate-base-data.js
// Execute UMA VEZ para gerar os arquivos de backup com dados históricos
// Uso: node scripts/generate-base-data.js

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');

console.log('\n🔧 Gerando arquivos base (backup)...\n');

// Estrutura base vazia
const estadisticasBase = {
  ultimaAtualizacao: new Date().toISOString(),
  totalRegistros: 0,
  anoAtual: new Date().getFullYear(),
  mesAtual: new Date().getMonth() + 1,
  porRubrica: {},
  porMunicipio: {},
  porBairro: {},
  porMesAno: {},
  porAno: {},
  porMes: {},
  porDiaSemana: {
    'domingo': 0,
    'segunda-feira': 0,
    'terça-feira': 0,
    'quarta-feira': 0,
    'quinta-feira': 0,
    'sexta-feira': 0,
    'sábado': 0
  },
  porHora: {},
  porTipoVeiculo: {},
  porMarcaVeiculo: {},
  porCorVeiculo: {},
  porPeriodo: {
    'Madrugada': 0,
    'Manhã': 0,
    'Tarde': 0,
    'Noite': 0
  },
  porAutoria: {
    conhecida: 0,
    desconhecida: 0
  },
  porFlagrante: {
    sim: 0,
    nao: 0
  },
  top10MarcasMaisRoubadas: []
};

// Inicializar horas
for (let i = 0; i < 24; i++) {
  estadisticasBase.porHora[String(i).padStart(2, '0')] = 0;
}

// Criar diretório se não existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Salvar arquivo principal
const estatisticasPath = path.join(DATA_DIR, 'estatisticas.json');
fs.writeFileSync(estatisticasPath, JSON.stringify(estadisticasBase, null, 2));
console.log('✅ estatisticas.json criado (estrutura vazia)\n');

// Salvar backup (mesmo conteúdo)
const backupPath = path.join(DATA_DIR, 'estatisticas-backup.json');
fs.writeFileSync(backupPath, JSON.stringify(estadisticasBase, null, 2));
console.log('✅ estatisticas-backup.json criado (backup inicial)\n');

// Criar mapa vazio
const mapaPath = path.join(DATA_DIR, 'mapa-ocorrencias.json');
fs.writeFileSync(mapaPath, JSON.stringify([], null, 2));
console.log('✅ mapa-ocorrencias.json criado (vazio)\n');

// Criar recentes vazio
const recentesPath = path.join(DATA_DIR, 'ocorrencias-recentes.json');
fs.writeFileSync(recentesPath, JSON.stringify([], null, 2));
console.log('✅ ocorrencias-recentes.json criado (vazio)\n');

// Criar top bairros vazio
const topBairrosPath = path.join(DATA_DIR, 'top-bairros.json');
fs.writeFileSync(topBairrosPath, JSON.stringify([], null, 2));
console.log('✅ top-bairros.json criado (vazio)\n');

// Criar top delegacias vazio
const topDelegaciasPath = path.join(DATA_DIR, 'top-delegacias.json');
fs.writeFileSync(topDelegaciasPath, JSON.stringify([], null, 2));
console.log('✅ top-delegacias.json criado (vazio)\n');

// Criar estado
const stateBase = {
  mesesProcessados: {},
  ultimaAtualizacao: new Date().toISOString(),
  usandoLFS: true,
  primeiraExecucao: true,
  versao: '2.0'
};

const statePath = path.join(DATA_DIR, 'processing-state.json');
fs.writeFileSync(statePath, JSON.stringify(stateBase, null, 2));
console.log('✅ processing-state.json criado (inicial)\n');

console.log('🎉 Arquivos base gerados com sucesso!\n');
console.log('📋 Próximas etapas:');
console.log('   1. git add data/*.json');
console.log('   2. git commit -m "📊 Adicionar arquivos base (estrutura vazia)"');
console.log('   3. git push\n');
console.log('Após isso, o GitHub Actions preencherá os dados!\n');