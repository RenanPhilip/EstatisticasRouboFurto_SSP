// update-data.js - ALINHADO COM test-local.js (DADOS IMUTÁVEIS + ÚLTIMOS 2 MESES)
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const CSV_DIR = path.join(__dirname, 'temp', 'csv');
const BASE_URL = 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub';

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

function carregarEstado() {
  try {
    const data = fs.readFileSync('data/processing-state.json', 'utf8');
    console.log('Conteúdo bruto de processing-state.json:', data);
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao carregar estado:', error.message);
    console.log('Conteúdo bruto ou erro:', data || 'Arquivo vazio ou inacessível');
    return { mesesProcessados: {}, ultimaAtualizacao: null, primeiraExecucao: true };
  }
}

function salvarEstado(state) {
  fs.writeFileSync(path.join(DATA_DIR, 'processing-state.json'), JSON.stringify(state, null, 2));
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

function processarXLSX(ano, mes, xlsxPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(xlsxPath)) {
      resolve({ ano, mes, registros: [] });
      return;
    }

    console.log(`   📄 Convertendo ${ano}.xlsx para CSV...`);
    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const csvData = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });

    const csvPath = path.join(CSV_DIR, `VeiculosSubtraidos_${ano}.csv`);
    if (!fs.existsSync(CSV_DIR)) {
      fs.mkdirSync(CSV_DIR, { recursive: true });
    }
    fs.writeFileSync(csvPath, csvData);

    processarCSV(ano, mes, csvPath).then(resolve);
  });
}

function processarCSV(ano, mes, csvPath) {
  return new Promise((resolve) => {
    const anoMesTarget = `${ano}-${String(mes).padStart(2, '0')}`;
    const registros = [];

    const conteudo = fs.readFileSync(csvPath, 'utf8');
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
      },
      complete: () => {
        resolve({ ano, mes, registros });
      },
      error: () => resolve({ ano, mes, registros: [] })
    });
  });
}

async function main() {
  console.log('🔄 Atualizando dados SSP...\n');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CSV_DIR)) {
    fs.mkdirSync(CSV_DIR, { recursive: true });
  }

  const state = carregarEstado();
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;
  const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
  const anoAnterior = mesAnterior === 12 ? anoAtual - 1 : anoAtual;

  // Apenas processa últimos 2 meses (atual + anterior)
  const mesesParaProcessar = [
    { ano: anoAtual, mes: mesAtual },
    { ano: anoAnterior, mes: mesAnterior }
  ];

  // Dados acumulados por ano
  const dadosAnoAtual = {};

  console.log(`📅 Período de atualização: ${anoAnterior}-${String(mesAnterior).padStart(2, '0')} até ${anoAtual}-${String(mesAtual).padStart(2, '0')}\n`);

  for (const { ano, mes } of mesesParaProcessar) {
    const anoMesStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const filePathDados = path.join(DATA_DIR, `${ano}_dados-completos.json`);

    // Verifica se arquivo de dados do ano já existe
    if (fs.existsSync(filePathDados)) {
      console.log(`📂 ${anoMesStr}`);
      console.log(`   ⏭️  ${ano}_dados-completos.json já existe (dados imutáveis). Pulando download.`);
      continue;
    }

    // Arquivo NÃO existe, precisa processar
    const fileName = `VeiculosSubtraidos_${ano}.xlsx`;
    const xlsxPath = path.join(__dirname, 'temp', fileName);
    const url = `${BASE_URL}/${fileName}`;

    try {
      console.log(`📂 ${anoMesStr}`);
      console.log(`   📥 Baixando ${ano}...`);
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 180000 });
      fs.writeFileSync(xlsxPath, response.data);
      console.log(`   ✅ Download concluído`);

      const resultado = await processarXLSX(ano, mes, xlsxPath);

      if (resultado.registros.length > 0) {
        console.log(`   ✅ ${resultado.registros.length} registros processados para ${anoMesStr}`);

        // Acumula dados do ano
        if (!dadosAnoAtual[ano]) {
          dadosAnoAtual[ano] = [];
        }
        dadosAnoAtual[ano].push(...resultado.registros);

        // Atualiza estado
        state.mesesProcessados[anoMesStr] = { dataProcessamento: agora.toISOString() };
      } else {
        console.log(`   ⚠️  Nenhum dado para ${anoMesStr}`);
      }
    } catch (error) {
      console.error(`   ❌ Erro ao processar ${ano}:`, error.message);
    }
  }

  // Salva dados novos de anos ainda não processados
  if (Object.keys(dadosAnoAtual).length > 0) {
    console.log(`\n💾 Salvando dados de novos anos...\n`);
    
    for (const [ano, dados] of Object.entries(dadosAnoAtual)) {
      const filePath = path.join(DATA_DIR, `${ano}_dados-completos.json`);
      fs.writeFileSync(filePath, JSON.stringify(dados, null, 2));

      const sizeMB = (JSON.stringify(dados).length / 1024 / 1024).toFixed(2);
      console.log(`   ✅ ${ano}_dados-completos.json (${sizeMB} MB - ${dados.length.toLocaleString('pt-BR')} registros)`);
    }
  } else {
    console.log(`\n✅ Todos os anos já foram processados (dados imutáveis).\n`);
  }

  state.ultimaAtualizacao = agora.toISOString();
  state.primeiraExecucao = false;
  salvarEstado(state);

  console.log(`✅ Atualização concluída!`);
  console.log(`🕐 Última atualização: ${agora.toLocaleString('pt-BR')}`);
}

main().catch(err => {
  console.error('❌ ERRO:', err);
  process.exit(1);
});