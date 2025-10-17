// update-data.js - VERSÃO OTIMIZADA PARA GRANDES ARQUIVOS (streaming)
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const puppeteer = require('puppeteer');

// Data atual
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TEMP_DIR = path.join(__dirname, 'temp');
const CSV_DIR = path.join(TEMP_DIR, 'csv');

// URL CORRIGIDA
const BASE_URL_DOWNLOAD = 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub';
const BASE_URL_PAGINA = 'https://www.ssp.sp.gov.br/estatistica/consultas';

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

function getTrimestre(mes) {
  return Math.ceil(mes / 3);
}

function getMesesDoTrimestre(trimestre) {
  const startMonth = (trimestre - 1) * 3 + 1;
  return [startMonth, startMonth + 1, startMonth + 2];
}

async function baixarArquivo(ano) {
  const fileName = `VeiculosSubtraidos_${ano}.xlsx`;
  const savePath = path.join(TEMP_DIR, fileName);

  console.log(`   📥 Tentando baixar ${fileName} (Ano ${ano})...`);

  if (fs.existsSync(savePath)) {
    console.log(`   ✓ Arquivo já existe localmente`);
    return savePath;
  }

  // Tentar baixar pela URL direta primeiro (mais rápido)
  const urlDireta = `${BASE_URL_DOWNLOAD}/${fileName}`;
  let tentativa = 1;
  const MAX_TENTATIVAS = 3;

  while (tentativa <= MAX_TENTATIVAS) {
    try {
      console.log(`   📡 Tentativa ${tentativa} de download direto...`);

      const response = await axios.get(urlDireta, { 
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
      console.log(`   ✅ Download Direto: ${sizeMB} MB`);
      
      return savePath;

    } catch (error) {
      console.log(`   ❌ Erro no download direto (${error.code || error.message})`);
      tentativa++;
      if (tentativa <= MAX_TENTATIVAS) {
        const espera = 5;
        console.log(`   ⏳ Aguardando ${espera}s...`);
        await new Promise(resolve => setTimeout(resolve, espera * 1000));
      }
    }
  }

  // Se falhar, tentar baixar via Puppeteer (simulando acesso à página)
  console.log(`   🌐 Tentando baixar via Puppeteer (página ${BASE_URL_PAGINA})...`);
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.goto(BASE_URL_PAGINA, { waitUntil: 'networkidle2', timeout: 60000 });

    const selector = `a[href*="/VeiculosSubtraidos_${ano}.xlsx"]`;
    console.log(`   🔍 Buscando link com seletor: ${selector}`);
    
    const link = await page.waitForSelector(selector, { timeout: 10000 }).catch(() => null);

    if (link) {
      console.log(`   🔗 Link encontrado. Tentando obter URL final...`);
      const finalUrl = await page.evaluate(el => el.href, link);

      if (finalUrl) {
        console.log(`   📡 Download via URL final: ${finalUrl}`);
        const response = await axios.get(finalUrl, { 
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
        console.log(`   ✅ Download via Puppeteer (axios): ${sizeMB} MB`);
        
        return savePath;
      }
    } else {
      console.log(`   ⚠️  Link não encontrado na página.`);
    }

  } catch (error) {
    console.error(`   ❌ Erro no Puppeteer: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return null;
}

// ⭐ NOVO: Leitura OTIMIZADA do XLSX em streaming
function processarXLSXOtimizado(ano, mes, xlsxPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(xlsxPath)) {
      console.log(`   ❌ Arquivo não encontrado`);
      return resolve({ ano, mes, registros: [] });
    }

    try {
      console.log(`   📄 Lendo XLSX em Streaming...`);
      
      const workbook = XLSX.readFile(xlsxPath);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        console.log(`   ❌ Nenhuma aba encontrada`);
        return resolve({ ano, mes, registros: [] });
      }

      // Converte a aba para CSV em string
      const csvString = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: ';', RS: '\n', strip: true });

      const anoMesTarget = `${ano}-${String(mes).padStart(2, '0')}`;
      const registros = [];
      let processados = 0;

      console.log(`   ⚙️  Processando CSV linha a linha (Streaming)...`);

      Papa.parse(csvString, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        transformHeader: h => h.trim(),
        dynamicTyping: false,
        step: (result) => {
          if (result.errors.length > 0) return;

          const row = result.data;
          processados++;

          // Log de progresso a cada 50k linhas
          if (processados % 50000 === 0) {
            console.log(`      Processados: ${processados.toLocaleString('pt-BR')}...`);
          }

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
          console.log(`   ✓ ${processados.toLocaleString('pt-BR')} linhas processadas, ${registros.length} válidas`);
          resolve({ ano, mes, registros });
        },
        error: (err) => {
          console.error(`   ❌ Erro ao processar CSV: ${err.message}`);
          reject(err);
        }
      });
      
    } catch (error) {
      console.error(`   ❌ Erro ao ler XLSX: ${error.message}`);
      resolve({ ano, mes, registros: [] });
    }
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

        const trimestre = getTrimestre(mes);
        const trimestreStr = `T${trimestre}`;
        const arquivoTrimestral = path.join(DATA_DIR, `${ano}_${trimestreStr}.json`);
        
        let dadosTrimestrais = [];
        if (fs.existsSync(arquivoTrimestral)) {
          try {
            const conteudo = fs.readFileSync(arquivoTrimestral, 'utf8');
            dadosTrimestrais = JSON.parse(conteudo);
          } catch (e) {
            console.warn(`   ⚠️  Erro ao ler arquivo trimestral existente. Recriando.`);
          }
        }
        
        // Remove os dados antigos do mês que está sendo atualizado
        const mesStr = String(mes).padStart(2, '0');
        const dadosFiltrados = dadosTrimestrais.filter(r => {
          const data = parseDate(r.DATA_OCORRENCIA_BO);
          return !data || data.getFullYear() !== ano || (data.getMonth() + 1) !== mes;
        });
        
        // Adiciona os novos dados
        dadosFiltrados.push(...resultado.registros);
        
        // Salva o arquivo trimestral atualizado
        fs.writeFileSync(arquivoTrimestral, JSON.stringify(dadosFiltrados, null, 2));

        const sizeMB = (JSON.stringify(dadosFiltrados).length / 1024 / 1024).toFixed(2);
        console.log(`   💾 Arquivo trimestral atualizado: ${path.basename(arquivoTrimestral)} (${sizeMB} MB | ${dadosFiltrados.length.toLocaleString('pt-BR')} registros)\n`);

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

  // Não há mais necessidade de salvar incrementais, a atualização é direta no arquivo trimestral.
  console.log(`\n✅ Processamento de atualização concluído.\n`);

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