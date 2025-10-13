const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '../data';
const BASE_URL = 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub';
const ANOS = [2023, 2024, 2025];  // Adicione mais anos se necessário

// Função para baixar e processar um XLSX
async function processarAno(ano) {
  const url = `${BASE_URL}/VeiculosSubtraidos_${ano}.xlsx`;
  console.log(`Baixando ${url}...`);
  
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const workbook = XLSX.read(response.data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];  // Assume primeira sheet
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Processados ${jsonData.length} registros para ${ano}`);
    return jsonData;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`Arquivo ${ano} não encontrado (normal se ano futuro). Pulando.`);
      return [];
    }
    console.error(`Erro ao processar ${ano}:`, error.message);
    return [];
  }
}

// Agregar estatísticas
function agregarEstatisticas(todosDados) {
  const stats = {
    ultimaAtualizacao: new Date().toISOString(),
    totalRegistros: todosDados.length,
    porRubrica: {},
    porAno: {},
    porMunicipio: {},
    porMesAno: {},
    porHora: {},
    porDiaSemana: {},
    porPeriodo: {  // Ex: 'Manhã', 'Tarde', etc. – ajuste baseado em hora
      'Manhã': 0, 'Tarde': 0, 'Noite': 0, 'Madrugada': 0
    },
    porTipoVeiculo: {},
    porCorVeiculo: {},
    porFlagrante: { sim: 0, nao: 0 },
    porAutoria: { conhecida: 0, desconhecida: 0 },
    top10MarcasMaisRoubadas: []
  };

  todosDados.forEach(row => {
    const rubrica = row.RUBRICA || 'DESCONHECIDA';
    const dataStr = row.DATA_OCORRENCIA;  // Assume formato DD/MM/YYYY
    const ano = new Date(dataStr.split('/').reverse().join('-')).getFullYear();
    const municipio = row.MUNICIPIO || 'DESCONHECIDO';
    const mes = new Date(dataStr).getMonth() + 1;
    const mesAno = `${mes.toString().padStart(2, '0')}/${ano}`;
    const hora = parseInt(row.HORA || 0);
    const diaSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][new Date(dataStr).getDay()];
    const tipoVeiculo = row.TIPO_VEICULO || 'DESCONHECIDO';
    const cor = row.COR_VEICULO || 'DESCONHECIDA';
    const marca = row.MARCA || 'DESCONHECIDA';
    const flagrante = row.FLAGRANTE === 'SIM' ? 'sim' : 'nao';
    const autoria = row.AUTORIA === 'CONHECIDA' ? 'conhecida' : 'desconhecida';

    // Contadores
    stats.porRubrica[rubrica] = (stats.porRubrica[rubrica] || 0) + 1;
    stats.porAno[ano] = (stats.porAno[ano] || 0) + 1;
    stats.porMunicipio[municipio] = (stats.porMunicipio[municipio] || 0) + 1;
    stats.porMesAno[mesAno] = (stats.porMesAno[mesAno] || 0) + 1;
    stats.porHora[hora] = (stats.porHora[hora] || 0) + 1;
    stats.porDiaSemana[diaSemana] = (stats.porDiaSemana[diaSemana] || 0) + 1;
    stats.porTipoVeiculo[tipoVeiculo] = (stats.porTipoVeiculo[tipoVeiculo] || 0) + 1;
    stats.porCorVeiculo[cor] = (stats.porCorVeiculo[cor] || 0) + 1;

    // Período baseado em hora
    if (hora >= 6 && hora < 12) stats.porPeriodo['Manhã']++;
    else if (hora >= 12 && hora < 18) stats.porPeriodo['Tarde']++;
    else if (hora >= 18 && hora < 24) stats.porPeriodo['Noite']++;
    else stats.porPeriodo['Madrugada']++;

    stats.porFlagrante[flagrante] = (stats.porFlagrante[flagrante] || 0) + 1;
    stats.porAutoria[autoria] = (stats.porAutoria[autoria] || 0) + 1;

    // Top 10 marcas (só para roubos)
    if (rubrica.includes('ROUBO')) {
      // Lógica simples para top10 (agregue em um Map e slice)
    }
  });

  // Top 10 marcas (exemplo placeholder – ajuste)
  stats.top10MarcasMaisRoubadas = Array.from({length: 10}, (_, i) => ({marca: `Marca ${i+1}`, count: 100 - i*10}));

  return stats;
}

// Gerar dados do mapa (amostra recente, com coords simuladas para SP)
function gerarDadosMapa(todosDados) {
  // Pega últimos 1000 registros
  const recentes = todosDados.slice(-1000).map(row => ({
    rubrica: row.RUBRICA,
    bairro: row.BAIRRO,
    municipio: row.MUNICIPIO,
    marca: row.MARCA,
    tipo: row.TIPO_VEICULO,
    data: row.DATA_OCORRENCIA,
    // Coords simuladas para SP (ajuste se Excel tiver lat/lng reais)
    lat: -23.55 + (Math.random() - 0.5) * 0.1,
    lng: -46.63 + (Math.random() - 0.5) * 0.1
  }));
  return recentes;
}

// Main
async function main() {
  console.log('Iniciando atualização de dados SSP...');
  
  const todosDados = [];
  for (const ano of ANOS) {
    const dadosAno = await processarAno(ano);
    todosDados.push(...dadosAno);
  }

  if (todosDados.length === 0) {
    console.error('Nenhum dado processado! Verifique URLs.');
    process.exit(1);
  }

  const estatisticas = agregarEstatisticas(todosDados);
  const mapaOcorrencias = gerarDadosMapa(todosDados);

  // Salvar JSONs
  fs.writeFileSync(path.join(DATA_DIR, 'estatisticas.json'), JSON.stringify(estatisticas, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'mapa-ocorrencias.json'), JSON.stringify(mapaOcorrencias, null, 2));

  console.log(`Gerados: ${estatisticas.totalRegistros} registros totais.`);
  console.log('Atualização concluída!');
}

main().catch(console.error);