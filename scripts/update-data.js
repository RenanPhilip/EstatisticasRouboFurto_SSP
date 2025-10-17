// update-data.js - VERSÃO OTIMIZADA PARA GRANDES ARQUIVOS (streaming)
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Data atual
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TEMP_DIR = path.join(__dirname, 'temp');
const CSV_DIR = path.join(TEMP_DIR, 'csv');

// URL CORRIGIDA
const BASE_URL = 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub';

const COLUNAS_ALTERNATIVAS = {
  'NOME_MUNICIPIO': ['CIDADE', 'NOME_MUNICIPIO_CIRC'],
  'DATA_OCORRENCIA_BO': ['DATA_OCORRENCIA'],
  'HORA_OCORRENCIA': ['HORA_OCORRENCIA_BO'],
  'NOME_DELEGACIA': ['NOME_DELEGACIA_CIRC'],
  'DESC_COR_VEICULO': ['DESCR_COR_VEICULO']
};

function ensureDirectories() {
  [DATA_DIR, TEMP_DIR, CSV_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function carregarEstado() {
  try {
    const statePath = path.join(DATA_DIR, 'processing-state.json');
    
    if (!fs.existsSync(statePath)) {
      console.log('📂 Arquivo de estado não encontrado. Criando novo...');
      return { mesesProcessados: {}, ultimaAtualizacao: null, usandoLFS: true };
    }

    const conteudo = fs.readFileSync(statePath, 'utf8');
    
    if (conteudo.includes('git-lfs') || conteudo.includes('version https://git-lfs')) {
      console.log('⚠️  processing-state.json é ponteiro LFS, recriando...');
      return { mesesProcessados: {}, ultimaAtualizacao: null, usandoLFS: true };
    }

    const state = JSON.parse(conteudo);
    console.log(`✅ Estado carregado: ${Object.keys(state.mesesProcessados).length} meses processados`);
    return state;
    
  } catch (error) {
    console.error('❌ Erro ao carregar estado:', error.message);
    return { mesesProcessados: {}, ultimaAtualizacao: null, usandoLFS: true };
  }
}

function salvarEstado(state) {
  const statePath = path.join(DATA_DIR, 'processing-state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`💾 Estado salvo`);
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

async function verificarArquivoExiste(url) {
  try {
    const response = await axios.head(url, { 
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function baixarArquivo(ano) {
  const fileName = `VeiculosSubtraidos_${ano}.xlsx`;
  const url = `${BASE_URL}/${fileName}`;
  const savePath = path.join(TEMP_DIR, fileName);

  console.log(`   📥 Tentando baixar ${fileName}...`);

  if (fs.existsSync(savePath)) {
    console.log(`   ✓ Arquivo já existe localmente`);
    return savePath;
  }

  console.log(`   🔍 Verificando existência...`);
  const existe = await verificarArquivoExiste(url);
  
  if (!existe) {
    console.log(`   ⚠️  Arquivo não encontrado na URL`);
    return null;
  }

  let tentativa = 1;
  const MAX_TENTATIVAS = 5;

  while (tentativa <= MAX_TENTATIVAS) {
    try {
      console.log(`   📡 Download (${tentativa}/${MAX_TENTATIVAS})...`);

      const response = await axios.get(url, { 
        responseType: 'arraybuffer', 
        timeout: 300000,
        maxContentLength: 500 * 1024 * 1024,
        maxBodyLength: 500 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      if (response.data.length < 1000) {
        throw new Error('Arquivo muito pequeno, pode ser erro HTML');
      }

      fs.writeFileSync(savePath, response.data);
      
      const sizeMB = (response.data.length / 1024 / 1024).toFixed(2);
      console.log(`   ✅ Download: ${sizeMB} MB`);
      
      return savePath;

    } catch (error) {
      tentativa++;
      
      console.log(`   ❌ Erro (${error.code || error.message})`);
      
      if (tentativa <= MAX_TENTATIVAS) {
        const espera = Math.min(120, 10 * Math.pow(2, tentativa - 2));
        console.log(`   ⏳ Aguardando ${espera}s...`);
        await new Promise(resolve => setTimeout(resolve, espera * 1000));
      }
    }
  }

  return null;
}

// ⭐ NOVO: Leitura OTIMIZADA do XLSX com limite de linhas
function processarXLSXOtimizado(ano, mes, xlsxPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(xlsxPath)) {
      console.log(`   ❌ Arquivo não encontrado`);
      resolve({ ano, mes, registros: [] });
      return;
    }

    try {
      console.log(`   📄 Lendo XLSX (otimizado)...`);
      
      // Ler arquivo com limite
      const workbook = XLSX.readFile(xlsxPath, {
        cellDates: true,
        cellFormula: false,
        cellHTML: false,
        cellNF: false,
        cellText: false,
        sheetStubs: false,
        defval: ''  // Valor padrão para células vazias
      });
      
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        console.log(`   ❌ Nenhuma aba encontrada`);
        resolve({ ano, mes, registros: [] });
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      
      // Converter XLSX para array de objetos (mais rápido que CSV)
      console.log(`   ⚙️  Convertendo dados...`);
      const linhas = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '',
        blankrows: false
      });

      console.log(`   ✓ Total de linhas no arquivo: ${linhas.length.toLocaleString('pt-BR')}`);

      processarLinhas(ano, mes, linhas).then(resolve);
      
    } catch (error) {
      console.error(`   ❌ Erro ao ler XLSX: ${error.message}`);
      resolve({ ano, mes, registros: [] });
    }
  });
}

function processarLinhas(ano, mes, linhas) {
  return new Promise((resolve) => {
    const anoMesTarget = `${ano}-${String(mes).padStart(2, '0')}`;
    const registros = [];
    let processados = 0;
    let filtrados = 0;

    console.log(`   🔄 Filtrando por mês ${anoMesTarget}...`);

    for (const row of linhas) {
      processados++;

      // Log de progresso a cada 50k linhas
      if (processados % 50000 === 0) {
        console.log(`      Processados: ${processados.toLocaleString('pt-BR')}...`);
      }

      const data = parseDate(getColumnValue(row, 'DATA_OCORRENCIA_BO'));

      if (!data) continue;

      const anoData = data.getFullYear();
      const mesData = data.getMonth() + 1;
      const anoMesData = `${anoData}-${String(mesData).padStart(2, '0')}`;

      if (anoMesData !== anoMesTarget) continue;

      filtrados++;

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
    }

    console.log(`   ✓ ${processados.toLocaleString('pt-BR')} processadas, ${registros.length} válidas`);
    resolve({ ano, mes, registros });
  });
}

async function main() {
  console.log('\n🔄 GITHUB ACTIONS - Atualizando dados SSP');
  console.log(`📅 Data: ${String(MES_ATUAL).padStart(2, '0')}/${ANO_ATUAL}\n`);

  ensureDirectories();

  const state = carregarEstado();
  const agora = new Date();

  const mesAnterior = MES_ATUAL === 1 ? 12 : MES_ATUAL - 1;
  const anoAnterior = mesAnterior === 12 ? ANO_ATUAL - 1 : ANO_ATUAL;

  const mesesParaProcessar = [
    { ano: ANO_ATUAL, mes: MES_ATUAL, tipo: 'ATUAL' },
    { ano: anoAnterior, mes: mesAnterior, tipo: 'ANTERIOR' }
  ];

  console.log(`📋 Processando:\n`);
  mesesParaProcessar.forEach(m => {
    console.log(`   • ${String(m.mes).padStart(2, '0')}/${m.ano} (mês ${m.tipo})`);
  });
  console.log();

  const dadosIncrementais = {};
  const anosUnicos = [...new Set(mesesParaProcessar.map(m => m.ano))];
  const arquivosXLSX = {};

  // Baixar arquivos
  for (const ano of anosUnicos) {
    const xlsxPath = await baixarArquivo(ano);
    arquivosXLSX[ano] = xlsxPath;

    if (xlsxPath) {
      console.log();
    } else {
      console.log(`   ⚠️  Pulando ano ${ano}\n`);
    }
  }

  // Processar meses
  for (const { ano, mes, tipo } of mesesParaProcessar) {
    const anoMesStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const xlsxPath = arquivosXLSX[ano];

    console.log(`📂 ${anoMesStr} (${tipo})`);

    if (!xlsxPath) {
      console.log(`   ⚠️  Arquivo não disponível\n`);
      continue;
    }

    try {
      const resultado = await processarXLSXOtimizado(ano, mes, xlsxPath);

      if (resultado.registros.length > 0) {
        console.log(`   ✅ ${resultado.registros.length} registros\n`);

        if (!dadosIncrementais[ano]) {
          dadosIncrementais[ano] = [];
        }
        dadosIncrementais[ano].push(...resultado.registros);

        state.mesesProcessados[anoMesStr] = { 
          dataProcessamento: agora.toISOString(),
          registros: resultado.registros.length
        };
      } else {
        console.log(`   ⚠️  Nenhum dado\n`);
      }
    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}\n`);
    }
  }

  // Salvar incrementais
  if (Object.keys(dadosIncrementais).length > 0) {
    console.log(`\n💾 Salvando incrementais...\n`);
    
    for (const [ano, dados] of Object.entries(dadosIncrementais)) {
      const mesStr = String(MES_ATUAL).padStart(2, '0');
      const incrementalPath = path.join(DATA_DIR, `incrementais-${ano}-${mesStr}.json`);
      
      fs.writeFileSync(incrementalPath, JSON.stringify(dados, null, 2));

      const sizeMB = (JSON.stringify(dados).length / 1024 / 1024).toFixed(2);
      console.log(`   ✓ incrementais-${ano}-${mesStr}.json (${sizeMB} MB | ${dados.length.toLocaleString('pt-BR')} registros)\n`);
    }
  } else {
    console.log(`\n⚠️  Nenhum dado processado\n`);
  }

  state.ultimaAtualizacao = agora.toISOString();
  state.usandoLFS = true;
  state.anoAtual = ANO_ATUAL;
  state.mesAtual = MES_ATUAL;
  salvarEstado(state);

  console.log(`✅ Concluído!\n`);
}

main().catch(err => {
  console.error('\n❌ ERRO:', err.message);
  process.exit(1);
});