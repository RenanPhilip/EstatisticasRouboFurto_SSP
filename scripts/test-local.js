const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Configurações
const DATA_DIR = '../data';
const SAMPLE_FILE = process.argv[2] || 'Amostra_Limpa.csv'; // Permite passar arquivo via argumento
const COLUNAS_NECESSARIAS = [
  'RUBRICA', 'DATA_OCORRENCIA_BO', 'NOME_MUNICIPIO', 'BAIRRO', 'DESCR_MARCA_VEICULO',
  'DESCR_TIPO_VEICULO', 'DESCR_COR_VEICULO', 'HORA_OCORRENCIA', 'FLAG_FLAGRANTE', 'AUTORIA_BO',
  'LATITUDE', 'LONGITUDE', 'NOME_DELEGACIA'
];

function processarAmostra() {
  console.log('✅ Iniciando teste local...');

  const filePath = path.join(__dirname, 'temp/csv', SAMPLE_FILE);
  if (!fs.existsSync(filePath)) {
    console.error('❌ Arquivo de amostra não encontrado:', filePath);
    return;
  }

  const csv = fs.readFileSync(filePath, 'utf8');
  const { data: jsonData } = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: header => header.trim(),
    transform: value => value.trim(),
    quotes: true // Garante tratamento de valores com vírgulas
  });

  const processedData = jsonData.map(row => {
    const filteredRow = {};
    COLUNAS_NECESSARIAS.forEach(col => {
      filteredRow[col] = row[col] || null;
    });
    const data = row['DATA_OCORRENCIA_BO'] ? new Date(row['DATA_OCORRENCIA_BO'] * 86400000 + new Date('1899-12-30').getTime()) : null;
    filteredRow.anoMes = data ? `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}` : 'DESCONHECIDO';
    return filteredRow;
  });

  console.log(`📄 Arquivo CSV carregado: ${SAMPLE_FILE}`);
  console.log(`🔍 Total de registros na amostra: ${processedData.length}`);

  const mesesProcessados = {};
  processedData.forEach(row => {
    const anoMes = row.anoMes;
    if (!mesesProcessados[anoMes]) mesesProcessados[anoMes] = [];
    mesesProcessados[anoMes].push(row);
  });

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  Object.entries(mesesProcessados).forEach(([anoMes, dados]) => {
    const basePath = path.join(DATA_DIR, `${anoMes}_`);
    fs.writeFileSync(`${basePath}estatisticas.json`, JSON.stringify({ totalRegistros: dados.length }, null, 2));
    console.log(`✅ Salvou amostra para ${anoMes}: ${dados.length} registros`);
  });

  console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
}

processarAmostra();