// scripts/test-local.js - SALVA DADOS BRUTOS POR ANO + ESTATÍSTICAS

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Data atual (automático - sempre pega os dados mais recentes)
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

// Configurações
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const CSV_DIR = path.join(__dirname, 'temp', 'csv');

const COLUNAS_NECESSARIAS = [
  'RUBRICA', 'DATA_OCORRENCIA_BO', 'NOME_MUNICIPIO', 'BAIRRO', 'DESCR_MARCA_VEICULO',
  'DESCR_TIPO_VEICULO', 'DESC_COR_VEICULO', 'HORA_OCORRENCIA', 'FLAG_FLAGRANTE', 'AUTORIA_BO',
  'LATITUDE', 'LONGITUDE', 'NOME_DELEGACIA'
];

const COLUNAS_ALTERNATIVAS = {
  'NOME_MUNICIPIO': ['CIDADE', 'NOME_MUNICIPIO_CIRC'],
  'DATA_OCORRENCIA_BO': ['DATA_OCORRENCIA'],
  'HORA_OCORRENCIA': ['HORA_OCORRENCIA_BO'],
  'NOME_DELEGACIA': ['NOME_DELEGACIA_CIRC'],
  'DESC_COR_VEICULO': ['DESCR_COR_VEICULO']
};

function gerarMesesDecrescentes() {
  const meses = [];
  for (let ano = ANO_ATUAL; ano >= 2020; ano--) {
    const mesMax = (ano === ANO_ATUAL) ? MES_ATUAL : 12;
    for (let mes = mesMax; mes >= 1; mes--) {
      meses.push({ ano, mes });
    }
  }
  return meses;
}

function limparConteudo(conteudo) {
  let limpo = conteudo;
  if (limpo.charCodeAt(0) === 0xFEFF) {
    limpo = limpo.slice(1);
  }
  limpo = limpo.replace(/nullnullnull+/g, '');
  return limpo.trim();
}

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

function sanitizeValue(value) {
  if (value === null || value === undefined || value === '' || (typeof value === 'string' && value.toLowerCase() === 'null')) {
    return null;
  }
  return String(value).trim().replace(/"/g, '\\"').replace(/\n|\r/g, ' ') || null;
}

function getColumnValue(row, col) {
  if (row[col] !== undefined) return sanitizeValue(row[col]);
  const alternativas = COLUNAS_ALTERNATIVAS[col] || [];
  for (const alt of alternativas) {
    if (row[alt] !== undefined) return sanitizeValue(row[alt]);
  }
  return null;
}

function processarCSV(ano, mes) {
  return new Promise((resolve) => {
    const filePath = path.join(CSV_DIR, `VeiculosSubtraidos_${ano}.csv`);
    
    if (!fs.existsSync(filePath)) {
      resolve({ ano, mes, registros: [], stats: {} });
      return;
    }

    const anoMesTarget = `${ano}-${String(mes).padStart(2, '0')}`;
    const registros = [];
    const stats = {
      porRubrica: {}, porMunicipio: {}, porBairro: {}, porMesAno: {},
      porAno: {}, porMes: {}, porDiaSemana: {}, porHora: {},
      porTipoVeiculo: {}, porMarcaVeiculo: {}, porCorVeiculo: {},
      porAutoria: { conhecida: 0, desconhecida: 0 },
      porFlagrante: { sim: 0, nao: 0 }
    };
    const marcasCount = {};

    const conteudo = fs.readFileSync(filePath, 'utf8');
    const limpo = limparConteudo(conteudo);

    Papa.parse(limpo, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
      dynamicTyping: false,
      step: (result) => {
        if (result.errors.length > 0) return;

        const row = result.data;
        const data = parseDate(getColumnValue(row, 'DATA_OCORRENCIA_BO'));
        
        if (!data) return;

        const anoData = data.getFullYear();
        const mesData = data.getMonth() + 1;
        const anoMesData = `${anoData}-${String(mesData).padStart(2, '0')}`;

        if (anoMesData !== anoMesTarget) return;

        const registro = {
          RUBRICA: getColumnValue(row, 'RUBRICA'),
          NOME_MUNICIPIO: getColumnValue(row, 'NOME_MUNICIPIO'),
          BAIRRO: getColumnValue(row, 'BAIRRO'),
          DESCR_MARCA_VEICULO: getColumnValue(row, 'DESCR_MARCA_VEICULO'),
          DESCR_TIPO_VEICULO: getColumnValue(row, 'DESCR_TIPO_VEICULO'),
          DESC_COR_VEICULO: getColumnValue(row, 'DESC_COR_VEICULO'),
          HORA_OCORRENCIA: getColumnValue(row, 'HORA_OCORRENCIA'),
          FLAG_FLAGRANTE: getColumnValue(row, 'FLAG_FLAGRANTE'),
          AUTORIA_BO: getColumnValue(row, 'AUTORIA_BO'),
          LATITUDE: getColumnValue(row, 'LATITUDE'),
          LONGITUDE: getColumnValue(row, 'LONGITUDE'),
          NOME_DELEGACIA: getColumnValue(row, 'NOME_DELEGACIA'),
          DATA_OCORRENCIA_BO: getColumnValue(row, 'DATA_OCORRENCIA_BO')
        };

        registros.push(registro);

        const rubrica = String(registro.RUBRICA || 'DESCONHECIDO').toUpperCase();
        stats.porRubrica[rubrica] = (stats.porRubrica[rubrica] || 0) + 1;

        const municipio = String(registro.NOME_MUNICIPIO || 'DESCONHECIDO').toUpperCase();
        stats.porMunicipio[municipio] = (stats.porMunicipio[municipio] || 0) + 1;

        const bairro = String(registro.BAIRRO || 'DESCONHECIDO').toUpperCase();
        stats.porBairro[bairro] = (stats.porBairro[bairro] || 0) + 1;

        stats.porMesAno[anoMesTarget.replace('-', '/')] = (stats.porMesAno[anoMesTarget.replace('-', '/')] || 0) + 1;
        stats.porAno[ano] = (stats.porAno[ano] || 0) + 1;
        stats.porMes[mes] = (stats.porMes[mes] || 0) + 1;

        const diaSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][data.getDay()];
        stats.porDiaSemana[diaSemana] = (stats.porDiaSemana[diaSemana] || 0) + 1;

        const hora = String(registro.HORA_OCORRENCIA || '00').split(':')[0].padStart(2, '0');
        stats.porHora[hora] = (stats.porHora[hora] || 0) + 1;

        const tipoVeiculo = String(registro.DESCR_TIPO_VEICULO || 'DESCONHECIDO').toUpperCase();
        stats.porTipoVeiculo[tipoVeiculo] = (stats.porTipoVeiculo[tipoVeiculo] || 0) + 1;

        const marca = String(registro.DESCR_MARCA_VEICULO || 'DESCONHECIDO').toUpperCase();
        stats.porMarcaVeiculo[marca] = (stats.porMarcaVeiculo[marca] || 0) + 1;

        if (rubrica.includes('ROUBO')) {
          marcasCount[marca] = (marcasCount[marca] || 0) + 1;
        }

        const cor = String(registro.DESC_COR_VEICULO || 'DESCONHECIDO').toUpperCase();
        stats.porCorVeiculo[cor] = (stats.porCorVeiculo[cor] || 0) + 1;

        const autoria = String(registro.AUTORIA_BO || '').toUpperCase();
        if (autoria.includes('CONHECIDA')) {
          stats.porAutoria.conhecida++;
        } else {
          stats.porAutoria.desconhecida++;
        }

        const flagrante = String(registro.FLAG_FLAGRANTE || '').toUpperCase();
        if (flagrante === 'S' || flagrante === 'SIM') {
          stats.porFlagrante.sim++;
        } else {
          stats.porFlagrante.nao++;
        }
      },
      complete: () => {
        stats.top10MarcasMaisRoubadas = Object.entries(marcasCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([marca, count]) => ({ marca, count }));

        resolve({ ano, mes, registros, stats });
      },
      error: () => resolve({ ano, mes, registros: [], stats: {} })
    });
  });
}

async function main() {
  console.log('==========================================');
  console.log('  TESTE LOCAL - Gerando JSONs');
  console.log('==========================================\n');
  console.log(`Data Atual: ${String(MES_ATUAL).padStart(2, '0')}/${ANO_ATUAL}`);
  console.log(`Processando ate: ${String(MES_ATUAL).padStart(2, '0')}/${ANO_ATUAL}\n`);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const meses = gerarMesesDecrescentes();
  
  const statsGlobal = {
    ultimaAtualizacao: new Date().toISOString(),
    totalRegistros: 0,
    anoAtual: ANO_ATUAL,
    mesAtual: MES_ATUAL,
    porRubrica: {}, porMunicipio: {}, porBairro: {}, porMesAno: {},
    porAno: {}, porMes: {}, porDiaSemana: {}, porHora: {},
    porTipoVeiculo: {}, porMarcaVeiculo: {}, porCorVeiculo: {},
    porAutoria: { conhecida: 0, desconhecida: 0 },
    porFlagrante: { sim: 0, nao: 0 },
    top10MarcasMaisRoubadas: []
  };

  let mapaGlobal = [];
  let recentesGlobal = [];
  const topMarcas = {};
  const state = { mesesProcessados: {}, ultimaAtualizacao: new Date().toISOString(), primeiraExecucao: false, anoAtual: ANO_ATUAL, mesAtual: MES_ATUAL };

  let anoAtualProcesso = null;
  let dadosAnoAtual = [];

  for (const { ano, mes } of meses) {
    const anoMesStr = `${ano}-${String(mes).padStart(2, '0')}`;
    console.log(`${anoMesStr}...`);
    
    const resultado = await processarCSV(ano, mes);
    
    if (anoAtualProcesso !== null && anoAtualProcesso !== ano) {
      const filePath = path.join(DATA_DIR, `${anoAtualProcesso}_dados-completos.json`);
      fs.writeFileSync(filePath, JSON.stringify(dadosAnoAtual, null, 2));
      const sizeMB = (JSON.stringify(dadosAnoAtual).length / 1024 / 1024).toFixed(2);
      console.log(`  Salvo: ${anoAtualProcesso}_dados-completos.json (${sizeMB} MB - ${dadosAnoAtual.length.toLocaleString('pt-BR')} registros)\n`);
      
      dadosAnoAtual = [];
      if (global.gc) global.gc();
    }

    anoAtualProcesso = ano;

    if (resultado.registros.length > 0) {
      console.log(`  OK: ${resultado.registros.length} registros`);
      
      dadosAnoAtual.push(...resultado.registros);
      statsGlobal.totalRegistros += resultado.registros.length;

      Object.entries(resultado.stats).forEach(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
          Object.entries(value).forEach(([k, v]) => {
            statsGlobal[key][k] = (statsGlobal[key][k] || 0) + v;
          });
        }
      });

      resultado.stats.top10MarcasMaisRoubadas.forEach(item => {
        topMarcas[item.marca] = (topMarcas[item.marca] || 0) + item.count;
      });

      mapaGlobal = resultado.registros
        .filter(r => r.LATITUDE && r.LONGITUDE)
        .concat(mapaGlobal)
        .slice(0, 5000);

      recentesGlobal = resultado.registros.concat(recentesGlobal).slice(0, 1000);

      state.mesesProcessados[anoMesStr] = { dataProcessamento: new Date().toISOString() };
    } else {
      console.log(`  VAZIO`);
    }
  }

  if (anoAtualProcesso !== null && dadosAnoAtual.length > 0) {
    const filePath = path.join(DATA_DIR, `${anoAtualProcesso}_dados-completos.json`);
    fs.writeFileSync(filePath, JSON.stringify(dadosAnoAtual, null, 2));
    const sizeMB = (JSON.stringify(dadosAnoAtual).length / 1024 / 1024).toFixed(2);
    console.log(`  Salvo: ${anoAtualProcesso}_dados-completos.json (${sizeMB} MB - ${dadosAnoAtual.length.toLocaleString('pt-BR')} registros)\n`);
  }

  statsGlobal.top10MarcasMaisRoubadas = Object.entries(topMarcas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([marca, count]) => ({ marca, count }));

  const topBairros = Object.entries(statsGlobal.porBairro)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([bairro, count]) => ({ bairro, count }));

  const topMunicipios = Object.entries(statsGlobal.porMunicipio)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([municipio, count]) => ({ municipio, count }));

  console.log('Salvando agregados...\n');

  fs.writeFileSync(path.join(DATA_DIR, 'estatisticas.json'), JSON.stringify(statsGlobal, null, 2));
  console.log(`  OK: estatisticas.json`);

  fs.writeFileSync(path.join(DATA_DIR, 'mapa-ocorrencias.json'), JSON.stringify(mapaGlobal, null, 2));
  console.log(`  OK: mapa-ocorrencias.json (${mapaGlobal.length} pontos)`);

  fs.writeFileSync(path.join(DATA_DIR, 'ocorrencias-recentes.json'), JSON.stringify(recentesGlobal, null, 2));
  console.log(`  OK: ocorrencias-recentes.json`);

  fs.writeFileSync(path.join(DATA_DIR, 'top-bairros.json'), JSON.stringify(topBairros, null, 2));
  console.log(`  OK: top-bairros.json`);

  fs.writeFileSync(path.join(DATA_DIR, 'top-delegacias.json'), JSON.stringify(topMunicipios, null, 2));
  console.log(`  OK: top-delegacias.json`);

  fs.writeFileSync(path.join(DATA_DIR, 'processing-state.json'), JSON.stringify(state, null, 2));
  console.log(`  OK: processing-state.json`);

  console.log(`\n==========================================`);
  console.log(`TOTAIS:`);
  console.log(`  Registros: ${statsGlobal.totalRegistros.toLocaleString('pt-BR')}`);
  console.log(`  Municipios: ${Object.keys(statsGlobal.porMunicipio).length}`);
  console.log(`  Meses processados: ${Object.keys(state.mesesProcessados).length}`);
  console.log(`  Pontos no mapa: ${mapaGlobal.length.toLocaleString('pt-BR')}`);
  console.log(`==========================================\n`);
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});