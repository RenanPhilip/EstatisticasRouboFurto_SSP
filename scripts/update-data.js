// update-data.js - VERSÃO CORRIGIDA COM MELHOR TRATAMENTO DE DOWNLOADS
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Data atual (automático - sempre pega os dados mais recentes)
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TEMP_DIR = path.join(__dirname, 'temp');
const CSV_DIR = path.join(TEMP_DIR, 'csv');

// URL CORRIGIDA
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

// Criar diretórios se não existirem
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
      return { 
        mesesProcessados: {}, 
        ultimaAtualizacao: null, 
        usandoLFS: true
      };
    }

    const conteudo = fs.readFileSync(statePath, 'utf8');
    
    if (conteudo.includes('git-lfs') || conteudo.includes('version https://git-lfs')) {
      console.log('⚠️  processing-state.json é ponteiro LFS, recriando...');
      return { 
        mesesProcessados: {}, 
        ultimaAtualizacao: null,
        usandoLFS: true
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
      usandoLFS: true
    };
  }
}

function salvarEstado(state) {
  const statePath = path.join(DATA_DIR, 'processing-state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`💾 Estado salvo`);
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

async function verificarArquivoExiste(url) {
  try {
    const response = await axios.head(url, { 
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
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

  // Verificar se já existe localmente
  if (fs.existsSync(savePath)) {
    console.log(`   ✓ Arquivo já existe localmente`);
    return savePath;
  }

  // Verificar se arquivo existe na URL
  console.log(`   🔍 Verificando existência do arquivo...`);
  const existe = await verificarArquivoExiste(url);
  
  if (!existe) {
    console.log(`   ⚠️  Arquivo não encontrado na URL`);
    return null;
  }

  let tentativa = 1;
  const MAX_TENTATIVAS = 5;

  while (tentativa <= MAX_TENTATIVAS) {
    try {
      console.log(`   📡 Download (tentativa ${tentativa}/${MAX_TENTATIVAS})...`);

      const response = await axios.get(url, { 
        responseType: 'arraybuffer', 
        timeout: 300000, // 5 minutos
        maxContentLength: 500 * 1024 * 1024, // 500MB
        maxBodyLength: 500 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Validar que é um arquivo XLSX válido
      if (response.data.length < 1000) {
        throw new Error('Arquivo muito pequeno, pode ser erro HTML');
      }

      // Verificar magic number do XLSX (ZIP)
      const header = response.data.slice(0, 4).toString('hex');
      if (header !== '504b0304' && header !== '504b0506' && header !== '504b0708') {
        console.log(`   ⚠️  Validação: header é ${header} (esperado 504b...)`);
        // Continuar mesmo assim
      }

      // Salvar arquivo
      fs.writeFileSync(savePath, response.data);
      
      const sizeMB = (response.data.length / 1024 / 1024).toFixed(2);
      console.log(`   ✅ Download: ${sizeMB} MB`);
      
      return savePath;

    } catch (error) {
      tentativa++;
      
      const errorCode = error.code || error.message;
      console.log(`   ❌ Erro (${errorCode})`);
      
      if (tentativa <= MAX_TENTATIVAS) {
        const espera = Math.min(120, 10 * Math.pow(2, tentativa - 2));
        console.log(`   ⏳ Aguardando ${espera}s antes de retry...`);
        await new Promise(resolve => setTimeout(resolve, espera * 1000));
      } else {
        console.log(`   ❌ Falha após ${MAX_TENTATIVAS} tentativas`);
        return null;
      }
    }
  }

  return null;
}

function processarXLSX(ano, mes, xlsxPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(xlsxPath)) {
      console.log(`   ❌ Arquivo não encontrado: ${xlsxPath}`);
      resolve({ ano, mes, registros: [] });
      return;
    }

    try {
      console.log(`   📄 Lendo XLSX...`);
      
      const workbook = XLSX.readFile(xlsxPath, {
        cellDates: true,
        cellNF: false,
        cellText: false,
        sheetStubs: false
      });
      
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        console.log(`   ❌ Nenhuma aba encontrada`);
        resolve({ ano, mes, registros: [] });
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const csvData = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });

      const csvPath = path.join(CSV_DIR, `VeiculosSubtraidos_${ano}.csv`);
      fs.writeFileSync(csvPath, csvData, 'utf8');

      console.log(`   ✓ Convertido para CSV`);

      processarCSV(ano, mes, csvPath).then(resolve);
    } catch (error) {
      console.error(`   ❌ Erro ao processar XLSX: ${error.message}`);
      resolve({ ano, mes, registros: [] });
    }
  });
}

function processarCSV(ano, mes, csvPath) {
  return new Promise((resolve) => {
    const anoMesTarget = `${ano}-${String(mes).padStart(2, '0')}`;
    const registros = [];

    try {
      const conteudo = fs.readFileSync(csvPath, 'utf8');
      const limpo = limparConteudo(conteudo);

      let processados = 0;

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
          processados++;
        },
        complete: () => {
          console.log(`   ✓ ${processados} registros processados, ${registros.length} válidos`);
          resolve({ ano, mes, registros });
        },
        error: (err) => {
          console.error(`   ❌ Erro CSV: ${err.message}`);
          resolve({ ano, mes, registros });
        }
      });
    } catch (error) {
      console.error(`   ❌ Erro leitura CSV: ${error.message}`);
      resolve({ ano, mes, registros: [] });
    }
  });
}

async function main() {
  console.log('\n🔄 GITHUB ACTIONS - Atualizando dados SSP\n');
  console.log(`📅 Data Atual: ${String(MES_ATUAL).padStart(2, '0')}/${ANO_ATUAL}\n`);

  ensureDirectories();

  const state = carregarEstado();
  const agora = new Date();

  // Definir meses para processar (atual e anterior)
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
  const arquivosProcessados = new Set();

  // Baixar arquivos por ano
  const anosUnicos = [...new Set(mesesParaProcessar.map(m => m.ano))];
  const arquivosXLSX = {};

  for (const ano of anosUnicos) {
    const xlsxPath = await baixarArquivo(ano);
    arquivosXLSX[ano] = xlsxPath;

    if (xlsxPath) {
      console.log();
    } else {
      console.log(`   ⚠️  Pulando ano ${ano} (arquivo não disponível)\n`);
    }
  }

  // Processar meses
  for (const { ano, mes, tipo } of mesesParaProcessar) {
    const anoMesStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const xlsxPath = arquivosXLSX[ano];

    console.log(`📂 ${anoMesStr} (${tipo})`);

    if (!xlsxPath) {
      console.log(`   ⚠️  Arquivo não disponível para este mês\n`);
      continue;
    }

    try {
      const resultado = await processarXLSX(ano, mes, xlsxPath);

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
        console.log(`   ⚠️  Nenhum dado para este mês\n`);
      }
    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}\n`);
    }
  }

  // Salvar incrementais se houver dados
  if (Object.keys(dadosIncrementais).length > 0) {
    console.log(`\n💾 Salvando incrementais...\n`);
    
    for (const [ano, dados] of Object.entries(dadosIncrementais)) {
      const mesStr = String(MES_ATUAL).padStart(2, '0');
      const incrementalPath = path.join(DATA_DIR, `incrementais-${ano}-${mesStr}.json`);
      
      fs.writeFileSync(incrementalPath, JSON.stringify(dados, null, 2));

      const sizeMB = (JSON.stringify(dados).length / 1024 / 1024).toFixed(2);
      console.log(`   ✓ incrementais-${ano}-${mesStr}.json`);
      console.log(`     └─ ${sizeMB} MB | ${dados.length.toLocaleString('pt-BR')} registros\n`);
    }
  } else {
    console.log(`\n⚠️  Nenhum dado foi processado\n`);
  }

  // Atualizar estado
  state.ultimaAtualizacao = agora.toISOString();
  state.usandoLFS = true;
  state.anoAtual = ANO_ATUAL;
  state.mesAtual = MES_ATUAL;
  salvarEstado(state);

  console.log(`✅ Atualização concluída!\n`);
  console.log(`📊 Resumo:`);
  console.log(`   • Meses processados: ${Object.keys(state.mesesProcessados).length}`);
  console.log(`   • Arquivos baixados: ${Object.values(arquivosXLSX).filter(Boolean).length}/${anosUnicos.length}`);
  console.log(`   • Última atualização: ${new Date(state.ultimaAtualizacao).toLocaleString('pt-BR')}\n`);
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});