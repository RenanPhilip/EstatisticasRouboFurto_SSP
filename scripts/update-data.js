// update-data.js - PARA GITHUB ACTIONS (Não reatualiza dados completos do LFS)
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Data atual (automático - sempre pega os dados mais recentes)
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

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

// ⭐ NÃO carrega dados completos (estão em LFS)
function carregarEstado() {
  try {
    const statePath = path.join(DATA_DIR, 'processing-state.json');
    
    if (!fs.existsSync(statePath)) {
      console.log('📂 Arquivo de estado não encontrado. Criando novo...');
      return { 
        mesesProcessados: {}, 
        ultimaAtualizacao: null, 
        usandoLFS: true,
        primeiraExecucaoComGitHub: true 
      };
    }

    const conteudo = fs.readFileSync(statePath, 'utf8');
    
    // Ignora ponteiros LFS para state (é pequeno, não deveria estar em LFS)
    if (conteudo.includes('git-lfs') || conteudo.includes('version https://git-lfs')) {
      console.warn('⚠️  processing-state.json é ponteiro LFS');
      return { 
        mesesProcessados: {}, 
        ultimaAtualizacao: null,
        usandoLFS: true,
        primeiraExecucaoComGitHub: true 
      };
    }

    const state = JSON.parse(conteudo);
    console.log(`✅ Estado carregado: ${Object.keys(state.mesesProcessados).length} meses processados`);
    return state;
    
  } catch (error) {
    console.error('❌ Erro ao carregar estado:', error.message);
    return { 
      mesesProcessados: {}, 
      ultimaAtualizacao: null,
      usandoLFS: true,
      primeiraExecucaoComGitHub: true 
    };
  }
}

function salvarEstado(state) {
  const statePath = path.join(DATA_DIR, 'processing-state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`💾 Estado salvo em ${statePath}`);
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
      console.log(`   ⚠️  Arquivo não encontrado: ${xlsxPath}`);
      resolve({ ano, mes, registros: [] });
      return;
    }

    try {
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
    } catch (error) {
      console.error(`   ❌ Erro ao converter XLSX: ${error.message}`);
      resolve({ ano, mes, registros: [] });
    }
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
      error: (err) => {
        console.error(`   ❌ Erro ao processar CSV: ${err.message}`);
        resolve({ ano, mes, registros: [] });
      }
    });
  });
}

async function main() {
  console.log('🔄 GITHUB ACTIONS - Atualizando dados SSP\n');
  console.log(`📅 Data Atual: ${String(MES_ATUAL).padStart(2, '0')}/${ANO_ATUAL}\n`);
  console.log('ℹ️  Nota: Dados históricos em LFS não serão reatualizados\n');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CSV_DIR)) {
    fs.mkdirSync(CSV_DIR, { recursive: true });
  }

  const state = carregarEstado();
  const agora = new Date();
  const mesAnterior = mesAtual === 1 ? 12 : MES_ATUAL - 1;
  const anoAnterior = mesAnterior === 12 ? ANO_ATUAL - 1 : ANO_ATUAL;

  // ⭐ APENAS últimos 2 meses (não toca nos dados históricos do LFS)
  const mesesParaProcessar = [
    { ano: ANO_ATUAL, mes: MES_ATUAL },
    { ano: anoAnterior, mes: mesAnterior }
  ];

  // Incrementais apenas (não concatena com LFS)
  const dadosIncrementais = {};

  console.log(`📅 Processando: ${anoAnterior}-${String(mesAnterior).padStart(2, '0')} até ${ANO_ATUAL}-${String(MES_ATUAL).padStart(2, '0')}\n`);

  for (const { ano, mes } of mesesParaProcessar) {
    const anoMesStr = `${ano}-${String(mes).padStart(2, '0')}`;

    const fileName = `VeiculosSubtraidos_${ano}.xlsx`;
    const xlsxPath = path.join(__dirname, 'temp', fileName);
    const url = `${BASE_URL}/${fileName}`;

    console.log(`📂 ${anoMesStr}`);
    console.log(`   📥 Baixando ${ano}...`);

    // Retry automático (máx 3 tentativas)
    let downloadSucesso = false;
    let tentativa = 1;
    const MAX_TENTATIVAS = 3;

    while (tentativa <= MAX_TENTATIVAS && !downloadSucesso) {
      try {
        if (tentativa > 1) {
          console.log(`   ↻ Tentativa ${tentativa}/${MAX_TENTATIVAS}...`);
        }

        const response = await axios.get(url, { 
          responseType: 'arraybuffer', 
          timeout: 180000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
        
        fs.writeFileSync(xlsxPath, response.data);
        console.log(`   ✅ Download concluído (${(response.data.length / 1024 / 1024).toFixed(2)} MB)`);
        downloadSucesso = true;

      const resultado = await processarXLSX(ano, mes, xlsxPath);

      if (resultado.registros.length > 0) {
        console.log(`   ✅ ${resultado.registros.length} registros processados`);

        // Armazena apenas incrementais
        if (!dadosIncrementais[ano]) {
          dadosIncrementais[ano] = [];
        }
        dadosIncrementais[ano].push(...resultado.registros);

        // Atualiza estado
        state.mesesProcessados[anoMesStr] = { 
          dataProcessamento: agora.toISOString(),
          registros: resultado.registros.length
        };
      } else {
        console.log(`   ⚠️  Nenhum dado para ${anoMesStr}`);
      }
    } catch (error) {
      console.error(`   ❌ Erro ao processar ${ano}:`, error.message);
    }
  }

  // ⭐ Salva APENAS incrementais (pequenos)
  if (Object.keys(dadosIncrementais).length > 0) {
    console.log(`\n💾 Salvando incrementais (últimos 2 meses)...\n`);
    
    for (const [ano, dados] of Object.entries(dadosIncrementais)) {
      // Arquivo separado para incrementais deste mês
      const mesAtualStr = String(mesAtual).padStart(2, '0');
      const incrementalPath = path.join(DATA_DIR, `incrementais-${ano}-${mesAtualStr}.json`);
      
      fs.writeFileSync(incrementalPath, JSON.stringify(dados, null, 2));

      const sizeMB = (JSON.stringify(dados).length / 1024 / 1024).toFixed(2);
      console.log(`   ✅ incrementais-${ano}-${mesAtualStr}.json (${sizeMB} MB - ${dados.length.toLocaleString('pt-BR')} registros)`);
    }
  }

  state.ultimaAtualizacao = agora.toISOString();
  state.usandoLFS = true;
  state.anoAtual = ANO_ATUAL;
  state.mesAtual = MES_ATUAL;
  state.tipoAtualizacao = 'GitHub Actions (incrementais)';
  salvarEstado(state);

  console.log(`\n✅ Atualização concluída!`);
  console.log(`📊 Próximo passo: Regenerar estatísticas com dados incrementais + LFS históricos`);
}

main().catch(err => {
  console.error('❌ ERRO FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});