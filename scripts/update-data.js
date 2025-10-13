const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '../data';
const BASE_URL = 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub';
const ANOS = [2023, 2024, 2025]; // Adicione mais anos se necessário

// Função para baixar e processar um XLSX
async function processarAno(ano) {
  const url = `${BASE_URL}/VeiculosSubtraidos_${ano}.xlsx`;
  console.log(`Baixando ${url}...`);
  
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const workbook = XLSX.read(response.data, { type: 'array' });
    const sheetName = workbook.SheetNames[0]; // Assume primeira sheet
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Processados ${jsonData.length} registros para ${ano}. Exemplo:`, jsonData.slice(0, 2));
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
    porPeriodo: { 'Manhã': 0, 'Tarde': 0, 'Noite': 0, 'Madrugada': 0 },
    porTipoVeiculo: {},
    porCorVeiculo: {},
    porFlagrante: { sim: 0, nao: 0 },
    porAutoria: { conhecida: 0, desconhecida: 0 },
    top10MarcasMaisRoubadas: []
  };

  todosDados.forEach(row => {
    const rubrica = row.RUBRICA || 'DESCONHECIDA';
    const dataStr = row.DATA_OCORRENCIA; // Assume formato DD/MM/YYYY
    const ano = new Date(dataStr.split('/').reverse().join('-')).getFullYear();
    const municipio = row.MUNICIPIO || 'DESCONHECIDO';
    const mes = new Date(dataStr).getMonth() + 1;
    const mesAno = `${mes.toString().padStart(2, '0')}/${ano}`;
    const hora = parseInt(row.HORA || 0);
    const diaSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][new Date(dataStr).getDay()];
    const tipoVeiculo = row.TIPO_VEICULO || 'DESCONHECIDO';
    const cor = row.COR_VEICULO || 'DESCONHECIDA';
    const marca = row.MARCA || 'DESCONHECIDO';
    const flagrante = row.FLAGRANTE === 'SIM' ? 'sim' : 'nao';
    const autoria = row.AUTORIA === 'CONHECIDA' ? 'conhecida' : 'desconhecida';

    stats.porRubrica[rubrica] = (stats.porRubrica[rubrica] || 0) + 1;
    stats.porAno[ano] = (stats.porAno[ano] || 0) + 1;
    stats.porMunicipio[municipio] = (stats.porMunicipio[municipio] || 0) + 1;
    stats.porMesAno[mesAno] = (stats.porMesAno[mesAno] || 0) + 1;
    stats.porHora[hora] = (stats.porHora[hora] || 0) + 1;
    stats.porDiaSemana[diaSemana] = (stats.porDiaSemana[diaSemana] || 0) + 1;
    stats.porTipoVeiculo[tipoVeiculo] = (stats.porTipoVeiculo[tipoVeiculo] || 0) + 1;
    stats.porCorVeiculo[cor] = (stats.porCorVeiculo[cor] || 0) + 1;

    if (hora >= 6 && hora < 12) stats.porPeriodo['Manhã']++;
    else if (hora >= 12 && hora < 18) stats.porPeriodo['Tarde']++;
    else if (hora >= 18 && hora < 24) stats.porPeriodo['Noite']++;
    else stats.porPeriodo['Madrugada']++;

    stats.porFlagrante[flagrante] = (stats.porFlagrante[flagrante] || 0) + 1;
    stats.porAutoria[autoria] = (stats.porAutoria[autoria] || 0) + 1;

    if (rubrica.includes('ROUBO')) {
      // Placeholder para top10MarcasMaisRoubadas (ajuste conforme necessário)
      stats.top10MarcasMaisRoubadas.push({ marca, count: 1 }); // Simplificado
    }
  });

  // Ordena e limita top10MarcasMaisRoubadas
  stats.top10MarcasMaisRoubadas = Object.values(
    stats.top10MarcasMaisRoubadas.reduce((acc, curr) => {
      acc[curr.marca] = (acc[curr.marca] || { marca: curr.marca, count: 0 });
      acc[curr.marca].count += curr.count;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count).slice(0, 10);

  return stats;
}

// Gerar dados do mapa (amostra recente)
function gerarDadosMapa(todosDados) {
  return todosDados.slice(-1000).map(row => ({
    rubrica: row.RUBRICA,
    bairro: row.BAIRRO,
    municipio: row.MUNICIPIO,
    marca: row.MARCA,
    tipo: row.TIPO_VEICULO,
    data: row.DATA_OCORRENCIA,
    lat: row.LAT || (-23.55 + (Math.random() - 0.5) * 0.1), // Simulado se não houver
    lng: row.LNG || (-46.63 + (Math.random() - 0.5) * 0.1)  // Simulado se não houver
  }));
}

// Gerar ocorrências recentes
function gerarOcorrenciasRecentes(todosDados) {
  return todosDados.slice(-100).map(row => ({
    rubrica: row.RUBRICA,
    data: row.DATA_OCORRENCIA,
    municipio: row.MUNICIPIO
  }));
}

// Gerar top bairros
function gerarTopBairros(todosDados) {
  const bairros = {};
  todosDados.forEach(row => {
    const bairro = row.BAIRRO || 'DESCONHECIDO';
    bairros[bairro] = (bairros[bairro] || 0) + 1;
  });
  return Object.entries(bairros)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([bairro, count]) => ({ bairro, count }));
}

// Gerar top delegacias (placeholder - ajuste com dados reais se disponíveis)
function gerarTopDelegacias(todosDados) {
  const delegacias = {};
  todosDados.forEach(row => {
    const delegacia = row.DELEGACIA || 'DESCONHECIDA'; // Ajuste o campo conforme o Excel
    delegacias[delegacia] = (delegacias[delegacia] || 0) + 1;
  });
  return Object.entries(delegacias)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([delegacia, count]) => ({ delegacia, count }));
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
  const ocorrenciasRecentes = gerarOcorrenciasRecentes(todosDados);
  const topBairros = gerarTopBairros(todosDados);
  const topDelegacias = gerarTopDelegacias(todosDados);

  // Salvar JSONs
  fs.writeFileSync(path.join(DATA_DIR, 'estatisticas.json'), JSON.stringify(estatisticas, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'mapa-ocorrencias.json'), JSON.stringify(mapaOcorrencias, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'ocorrencias-recentes.json'), JSON.stringify(ocorrenciasRecentes, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'top-bairros.json'), JSON.stringify(topBairros, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'top-delegacias.json'), JSON.stringify(topDelegacias, null, 2));

  console.log(`Gerados: ${estatisticas.totalRegistros} registros totais.`);
  console.log('Atualização concluída!');
}

main().catch(console.error);