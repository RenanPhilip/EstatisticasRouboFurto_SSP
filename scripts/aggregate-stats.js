// scripts/aggregate-stats.js
// Lê dados completos (LFS) e gera estatísticas agregadas
// Uso: node scripts/aggregate-stats.js

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');

console.log('\n🔄 Agregando dados completos em estatísticas...\n');

// Estrutura base
const stats = {
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
  stats.porHora[String(i).padStart(2, '0')] = 0;
}

// Arrays para filtragem posterior
let mapaGlobal = [];
let recentesGlobal = [];
const marcasCount = {};

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.toLowerCase() === 'null') {
    return null;
  }
  const match = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [_, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}`);
  return isNaN(date.getTime()) ? null : date;
}

function processarRegistro(registro) {
  stats.totalRegistros++;

  // Por rubrica
  const rubrica = String(registro.RUBRICA || 'DESCONHECIDO').toUpperCase();
  stats.porRubrica[rubrica] = (stats.porRubrica[rubrica] || 0) + 1;

  // Por município
  const municipio = String(registro.NOME_MUNICIPIO || 'DESCONHECIDO').toUpperCase();
  stats.porMunicipio[municipio] = (stats.porMunicipio[municipio] || 0) + 1;

  // Por bairro
  const bairro = String(registro.BAIRRO || 'DESCONHECIDO').toUpperCase();
  stats.porBairro[bairro] = (stats.porBairro[bairro] || 0) + 1;

  // Por data
  const data = parseDate(registro.DATA_OCORRENCIA_BO);
  if (data) {
    const ano = data.getFullYear();
    const mes = data.getMonth() + 1;
    const anoMesStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const anoMesDisplay = anoMesStr.replace('-', '/');

    stats.porMesAno[anoMesDisplay] = (stats.porMesAno[anoMesDisplay] || 0) + 1;
    stats.porAno[ano] = (stats.porAno[ano] || 0) + 1;
    stats.porMes[mes] = (stats.porMes[mes] || 0) + 1;

    // Por dia da semana
    const diaSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][data.getDay()];
    stats.porDiaSemana[diaSemana]++;
  }

  // Por hora
  if (registro.HORA_OCORRENCIA) {
    const hora = String(registro.HORA_OCORRENCIA).split(':')[0].padStart(2, '0');
    stats.porHora[hora] = (stats.porHora[hora] || 0) + 1;
  }

  // Por tipo de veículo
  const tipoVeiculo = String(registro.DESCR_TIPO_VEICULO || 'DESCONHECIDO').toUpperCase();
  stats.porTipoVeiculo[tipoVeiculo] = (stats.porTipoVeiculo[tipoVeiculo] || 0) + 1;

  // Por marca
  const marca = String(registro.DESCR_MARCA_VEICULO || 'DESCONHECIDO').toUpperCase();
  stats.porMarcaVeiculo[marca] = (stats.porMarcaVeiculo[marca] || 0) + 1;

  // Top marcas (apenas roubos)
  if (rubrica.includes('ROUBO')) {
    marcasCount[marca] = (marcasCount[marca] || 0) + 1;
  }

  // Por cor
  const cor = String(registro.DESC_COR_VEICULO || 'DESCONHECIDO').toUpperCase();
  stats.porCorVeiculo[cor] = (stats.porCorVeiculo[cor] || 0) + 1;

  // Por período do dia
  if (registro.HORA_OCORRENCIA) {
    const hora = parseInt(String(registro.HORA_OCORRENCIA).split(':')[0]);
    if (hora >= 0 && hora < 6) stats.porPeriodo['Madrugada']++;
    else if (hora >= 6 && hora < 12) stats.porPeriodo['Manhã']++;
    else if (hora >= 12 && hora < 18) stats.porPeriodo['Tarde']++;
    else if (hora >= 18 && hora < 24) stats.porPeriodo['Noite']++;
  }

  // Por autoria
  const autoria = String(registro.AUTORIA_BO || '').toUpperCase();
  if (autoria.includes('CONHECIDA')) {
    stats.porAutoria.conhecida++;
  } else {
    stats.porAutoria.desconhecida++;
  }

  // Por flagrante
  const flagrante = String(registro.FLAG_FLAGRANTE || '').toUpperCase();
  if (flagrante === 'S' || flagrante === 'SIM') {
    stats.porFlagrante.sim++;
  } else {
    stats.porFlagrante.nao++;
  }

  // Para mapa (adiciona ao final para manter os mais recentes)
  if (registro.LATITUDE && registro.LONGITUDE) {
    mapaGlobal.push(registro);
  }

  // Para recentes (últimos registros)
  recentesGlobal.push(registro);
}
F
function main() {
  console.log('📂 Procurando arquivos de dados completos...\n');

  // Encontrar todos os arquivos *_T[1-4].json
  const arquivos = fs.readdirSync(DATA_DIR)
    .filter(f => f.match(/\d{4}_T[1-4]\.json$/))
    .sort((a, b) => {
      // Ordena por ano (crescente) e depois por trimestre (crescente)
      const [anoA, trimestreA] = a.match(/(\d{4})_T(\d)\.json$/).slice(1);
      const [anoB, trimestreB] = b.match(/(\d{4})_T(\d)\.json$/).slice(1);
      
      if (anoA !== anoB) return parseInt(anoA) - parseInt(anoB);
      return parseInt(trimestreA) - parseInt(trimestreB);
    });

  console.log(`🔍 Encontrados ${arquivos.length} arquivos:\n`);

  if (arquivos.length === 0) {
    console.error('❌ Nenhum arquivo *_T[1-4].json encontrado!');
    console.error('   Execute process-local.js primeiro\n');
    process.exit(1);
  }

  let totalGeral = 0;

  // Processar cada arquivo
  for (const arquivo of arquivos) {
    const filePath = path.join(DATA_DIR, arquivo);
    console.log(`📄 Processando: ${arquivo}`);

    try {
      const conteudo = fs.readFileSync(filePath, 'utf8');

      // Validar se é JSON válido (não ponteiro LFS)
      if (conteudo.includes('git-lfs') || conteudo.includes('version https://git-lfs')) {
        console.log(`   ⚠️  Arquivo é ponteiro LFS (não pode ler)\n`);
        continue;
      }

      const dados = JSON.parse(conteudo);

      if (!Array.isArray(dados)) {
        console.log(`   ⚠️  Arquivo não é array\n`);
        continue;
      }

      console.log(`   📊 ${dados.length.toLocaleString('pt-BR')} registros`);

      // Processar cada registro
      for (const registro of dados) {
        processarRegistro(registro);
      }

      totalGeral += dados.length;
      console.log(`   ✅ Processado\n`);

    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}\n`);
    }
  }

  console.log('═'.repeat(50));
  console.log(`✅ Total de registros agregados: ${stats.totalRegistros.toLocaleString('pt-BR')}\n`);

  // Top 10 marcas
  stats.top10MarcasMaisRoubadas = Object.entries(marcasCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([marca, count]) => ({ marca, count }));

  // Top bairros
  const topBairros = Object.entries(stats.porBairro)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([bairro, count]) => ({ bairro, count }));

  // Top delegacias (municípios)
  const topDelegacias = Object.entries(stats.porMunicipio)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([municipio, count]) => ({ municipio, count }));

  // Mapa: manter últimos 20k pontos
  if (mapaGlobal.length > 20000) {
    console.log(`📍 Mapa: ${mapaGlobal.length.toLocaleString('pt-BR')} pontos → limitando a 20.000`);
    mapaGlobal = mapaGlobal.slice(-20000);
  }

  // Recentes: manter últimos 10k registros
  if (recentesGlobal.length > 10000) {
    console.log(`📋 Recentes: ${recentesGlobal.length.toLocaleString('pt-BR')} registros → limitando a 10.000\n`);
    recentesGlobal = recentesGlobal.slice(-10000);
  }

  // Salvar arquivos
  console.log('💾 Salvando arquivos...\n');

  fs.writeFileSync(path.join(DATA_DIR, 'estatisticas.json'), JSON.stringify(stats, null, 2));
  console.log('   ✅ estatisticas.json');

  fs.writeFileSync(path.join(DATA_DIR, 'estatisticas-backup.json'), JSON.stringify(stats, null, 2));
  console.log('   ✅ estatisticas-backup.json');

  fs.writeFileSync(path.join(DATA_DIR, 'mapa-ocorrencias.json'), JSON.stringify(mapaGlobal, null, 2));
  console.log(`   ✅ mapa-ocorrencias.json (${mapaGlobal.length.toLocaleString('pt-BR')} pontos)`);

  fs.writeFileSync(path.join(DATA_DIR, 'ocorrencias-recentes.json'), JSON.stringify(recentesGlobal, null, 2));
  console.log(`   ✅ ocorrencias-recentes.json (${recentesGlobal.length.toLocaleString('pt-BR')} registros)`);

  fs.writeFileSync(path.join(DATA_DIR, 'top-bairros.json'), JSON.stringify(topBairros, null, 2));
  console.log(`   ✅ top-bairros.json (${topBairros.length} bairros)`);

  fs.writeFileSync(path.join(DATA_DIR, 'top-delegacias.json'), JSON.stringify(topDelegacias, null, 2));
  console.log(`   ✅ top-delegacias.json (${topDelegacias.length} municípios)\n`);

  // Atualizar estado
  const state = {
    mesesProcessados: {},
    ultimaAtualizacao: new Date().toISOString(),
    usandoLFS: true,
    anoAtual: new Date().getFullYear(),
    mesAtual: new Date().getMonth() + 1,
    totalRegistros: stats.totalRegistros
  };

  fs.writeFileSync(path.join(DATA_DIR, 'processing-state.json'), JSON.stringify(state, null, 2));
  console.log('   ✅ processing-state.json\n');

  console.log('═'.repeat(50));
  console.log('✅ AGREGAÇÃO CONCLUÍDA!\n');
  console.log('📋 Próximos passos:');
  console.log('   1. git add data/*.json');
  console.log('   2. git commit -m "✨ Agregar dados em estatísticas"');
  console.log('   3. git push');
  console.log('   4. Aguarde 2-3 minutos');
  console.log('   5. Atualize o navegador\n');
}

try {
  main();
} catch (err) {
  console.error('\n❌ ERRO:', err.message);
  console.error(err.stack);
  process.exit(1);
}