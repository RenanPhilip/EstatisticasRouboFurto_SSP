const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const DATA_DIR = '../data';
const BASE_URL = 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub';
const COLUNAS_NECESSARIAS = [
  'RUBRICA', 'DATA_OCORRENCIA_BO', 'NOME_MUNICIPIO', 'BAIRRO', 'DESCR_MARCA_VEICULO',
  'DESCR_TIPO_VEICULO', 'DESCR_COR_VEICULO', 'HORA_OCORRENCIA', 'FLAG_FLAGRANTE', 'AUTORIA_BO',
  'LATITUDE', 'LONGITUDE', 'NOME_DELEGACIA'
];

function carregarEstado() {
  const statePath = path.join(DATA_DIR, 'processing-state.json');
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  return { mesesProcessados: {}, ultimaAtualizacao: null, primeiraExecucao: true };
}

function salvarEstado(state) {
  fs.writeFileSync(path.join(DATA_DIR, 'processing-state.json'), JSON.stringify(state, null, 2));
}

function processarCSV(ano, mes, filePath) {
  console.log(`Processando ${ano}-${mes} de ${filePath} (CSV)...`);
  const csv = fs.readFileSync(filePath, 'utf8');
  const { data: jsonData } = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: header => header.trim(),
    transform: value => value.trim(),
    quotes: true
  });

  const processedData = jsonData.map(row => {
    const filteredRow = {};
    COLUNAS_NECESSARIAS.forEach(col => {
      filteredRow[col] = row[col] || null;
    });
    const data = row['DATA_OCORRENCIA_BO'] ? new Date(row['DATA_OCORRENCIA_BO'] * 86400000 + new Date('1899-12-30').getTime()) : null;
    filteredRow.anoMes = data ? `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}` : 'DESCONHECIDO';
    return filteredRow;
  }).filter(row => row.anoMes === `${ano}-${mes.padStart(2, '0')}`);

  if (processedData.length > 0) {
    const basePath = path.join(DATA_DIR, `${ano}-${mes.padStart(2, '0')}_`);
    fs.writeFileSync(`${basePath}estatisticas.json`, JSON.stringify({ totalRegistros: processedData.length }, null, 2));
    console.log(`✅ Salvou ${processedData.length} registros para ${ano}-${mes}`);
  } else {
    console.log(`⚠️ Nenhum dado para ${ano}-${mes} em ${filePath}`);
  }
  return processedData.length;
}

async function processarXLSX(ano, mes, filePath) {
  console.log(`Processando ${ano}-${mes} de ${filePath} (XLSX)...`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 1 })
    .map(row => {
      const filteredRow = {};
      COLUNAS_NECESSARIAS.forEach(col => {
        filteredRow[col] = row[col] || null;
      });
      const data = row['DATA_OCORRENCIA_BO'] ? new Date(row['DATA_OCORRENCIA_BO'] * 86400000 + new Date('1899-12-30').getTime()) : null;
      filteredRow.anoMes = data ? `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}` : 'DESCONHECIDO';
      return filteredRow;
    })
    .filter(row => row.anoMes === `${ano}-${mes.padStart(2, '0')}`);

  if (jsonData.length > 0) {
    const basePath = path.join(DATA_DIR, `${ano}-${mes.padStart(2, '0')}_`);
    fs.writeFileSync(`${basePath}estatisticas.json`, JSON.stringify({ totalRegistros: jsonData.length }, null, 2));
    console.log(`✅ Salvou ${jsonData.length} registros para ${ano}-${mes}`);
  } else {
    console.log(`⚠️ Nenhum dado para ${ano}-${mes} em ${filePath}`);
  }
  return jsonData.length;
}

async function main() {
  console.log('Iniciando atualização de dados SSP...');
  const state = carregarEstado();
  const agora = new Date(); // 14/10/2025 03:52 BRT
  const anoAtual = agora.getFullYear(); // 2025
  const mesAtual = agora.getMonth() + 1; // 10 (outubro)
  const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1; // 9 (setembro)
  const anoAnterior = mesAnterior === 12 ? anoAtual - 1 : anoAtual; // 2025

  const mesesParaProcessar = [
    { ano: anoAtual, mes: mesAtual },
    { ano: anoAnterior, mes: mesAnterior }
  ].concat(
    // Primeiro carregamento para anos anteriores
    state.primeiraExecucao ? [
      { ano: 2020, mes: 1 }, { ano: 2020, mes: 12 },
      { ano: 2021, mes: 1 }, { ano: 2021, mes: 12 },
      { ano: 2022, mes: 1 }, { ano: 2022, mes: 12 },
      { ano: 2023, mes: 1 }, { ano: 2023, mes: 12 },
      { ano: 2024, mes: 1 }, { ano: 2024, mes: 12 },
      { ano: 2025, mes: 1 }, { ano: 2025, mes: 9 } // Até setembro/2025
    ] : []
  );

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  for (const { ano, mes } of mesesParaProcessar) {
    const anoMes = `${ano}-${mes.toString().padStart(2, '0')}`;
    const stateKey = `${ano}-${mes.toString().padStart(2, '0')}`;
    if (state.mesesProcessados[stateKey] && !state.primeiraExecucao && mes !== mesAtual && mes !== mesAnterior) {
      console.log(`⏭️ ${anoMes} já processado e imutável. Pulando.`);
      continue;
    }

    const fileName = `VeiculosSubtraidos_${ano}.csv`;
    const csvPath = path.join(__dirname, 'temp/csv', fileName);
    const xlsxPath = path.join(__dirname, 'temp', `VeiculosSubtraidos_${ano}.xlsx`);

    if (state.primeiraExecucao || ano < anoAtual || (ano === anoAtual && mes <= 9)) {
      // Primeiro carregamento: usa CSV local para todos os anos até setembro/2025
      if (fs.existsSync(csvPath)) {
        processarCSV(ano, mes, csvPath);
      } else {
        console.error(`❌ CSV ${csvPath} não encontrado para ${ano}-${mes}`);
      }
    } else if (ano === anoAtual && (mes === mesAtual || mes === mesAnterior)) {
      // Atualizações futuras: baixa XLSX do site
      const url = `${BASE_URL}/VeiculosSubtraidos_${ano}.xlsx`;
      try {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 180000 });
        fs.writeFileSync(xlsxPath, response.data);
        await processarXLSX(ano, mes, xlsxPath);
      } catch (error) {
        console.error(`❌ Erro ao baixar ${url}:`, error.message);
      }
    }
  }

  state.ultimaAtualizacao = agora.toISOString();
  mesesParaProcessar.forEach(({ ano, mes }) => {
    state.mesesProcessados[`${ano}-${mes.toString().padStart(2, '0')}`] = { dataProcessamento: agora.toISOString() };
  });
  state.primeiraExecucao = false; // Marca como concluída após a primeira execução
  salvarEstado(state);

  console.log('✅ Atualização concluída!');
}

main().catch(console.error);