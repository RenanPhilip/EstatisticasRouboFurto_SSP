const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configurações
const anoAtual = new Date().getFullYear(); // 2025
const ANOS = [anoAtual, anoAtual - 1, anoAtual - 2]; // [2025, 2024, 2023]
const DATA_DIR = '../data';
const BASE_URL = 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub';
const COLUNAS_NECESSARIAS = [
  'RUBRICA', 'DATA_OCORRENCIA', 'MUNICIPIO', 'BAIRRO', 'MARCA',
  'TIPO_VEICULO', 'COR_VEICULO', 'HORA', 'FLAGRANTE', 'AUTORIA', 'LAT', 'LNG', 'DELEGACIA'
];

// Função para carregar estado (anos processados e última atualização)
function carregarEstado() {
  const statePath = path.join(DATA_DIR, 'state.json');
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  return { anosProcessados: [], ultimaAtualizacao: null };
}

// Função para salvar estado
function salvarEstado(state) {
  fs.writeFileSync(path.join(DATA_DIR, 'state.json'), JSON.stringify(state, null, 2));
}

// Função para baixar e processar um XLSX com retries
async function processarAno(ano, maxRetries = 3) {
  const url = `${BASE_URL}/VeiculosSubtraidos_${ano}.xlsx`;
  console.log(`Baixando ${url}...`);

  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 }); // 60s timeout
      const workbook = XLSX.read(response.data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Ler todas as linhas e filtrar colunas necessárias
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 1 }) // Ignora cabeçalho
        .map(row => {
          const filteredRow = {};
          COLUNAS_NECESSARIAS.forEach(col => {
            filteredRow[col] = row[col] || null;
          });
          return filteredRow;
        });

      if (jsonData.length === 0) return [];

      // Verificar ordem das datas (primeira e última linha)
      const dataPrimeira = jsonData[0].DATA_OCORRENCIA ? new Date(jsonData[0].DATA_OCORRENCIA.split('/').reverse().join('-')) : new Date(0);
      const dataUltima = jsonData[jsonData.length - 1].DATA_OCORRENCIA ? new Date(jsonData[jsonData.length - 1].DATA_OCORRENCIA.split('/').reverse().join('-')) : new Date(0);
      const ordemDescendente = dataPrimeira > dataUltima;

      // Ordenar por data descendente
      jsonData.sort((a, b) => {
        const dataA = a.DATA_OCORRENCIA ? new Date(a.DATA_OCORRENCIA.split('/').reverse().join('-')) : new Date(0);
        const dataB = b.DATA_OCORRENCIA ? new Date(b.DATA_OCORRENCIA.split('/').reverse().join('-')) : new Date(0);
        return dataB - dataA;
      });

      console.log(`Processados ${jsonData.length} registros para ${ano}. Ordem original: ${ordemDescendente ? 'descendente' : 'ascendente'}. Exemplo:`, jsonData.slice(0, 2));
      return jsonData;
    } catch (error) {
      if (tentativa === maxRetries) {
        if (error.response?.status === 404) {
          console.log(`Arquivo ${ano} não encontrado (normal se ano futuro). Pulando.`);
          return [];
        }
        console.error(`Erro ao processar ${ano} após ${maxRetries} tentativas:`, error.message);
        return [];
      }
      console.log(`Tentativa ${tentativa} falhou para ${ano}. Tentando novamente em 10s...`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // Aguarda 10s antes de retry
    }
  }
}

// Processar e salvar em blocos de 1000 linhas
function processarEmBlocos(dadosTotais, blocoSize = 1000) {
  const resultados = { estatisticas: [], mapa: [], recentes: [], bairros: [], delegacias: [] };
  for (let i = 0; i < dadosTotais.length; i += blocoSize) {
    const bloco = dadosTotais.slice(i, i + blocoSize);
    const estatisticasParciais = agregarEstatisticas(bloco);
    resultados.estatisticas.push(estatisticasParciais);

    const mapaParcial = gerarDadosMapa(bloco);
    resultados.mapa.push(...mapaParcial);

    const recentesParciais = gerarOcorrenciasRecentes(bloco);
    resultados.recentes.push(...recentesParciais);

    const bairrosParciais = gerarTopBairros(bloco);
    resultados.bairros.push(...bairrosParciais);

    const delegaciasParciais = gerarTopDelegacias(bloco);
    resultados.delegacias.push(...delegaciasParciais);

    // Salvar incrementalmente
    fs.writeFileSync(path.join(DATA_DIR, 'estatisticas.json'), JSON.stringify(estatisticasParciais, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'mapa-ocorrencias.json'), JSON.stringify(resultados.mapa, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'ocorrencias-recentes.json'), JSON.stringify(resultados.recentes, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'top-bairros.json'), JSON.stringify(resultados.bairros, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'top-delegacias.json'), JSON.stringify(resultados.delegacias, null, 2));
    console.log(`Bloco ${i / blocoSize + 1} processado e salvo. Total registros: ${i + bloco.length}`);
  }
  return resultados;
}

// Agregar estatísticas
function agregarEstatisticas(dados) {
  const stats = {
    ultimaAtualizacao: new Date().toISOString(),
    totalRegistros: dados.length,
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

  dados.forEach(row => {
    const rubrica = row.RUBRICA || 'DESCONHECIDA';
    const dataStr = row.DATA_OCORRENCIA;
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
      stats.top10MarcasMaisRoubadas.push({ marca, count: 1 });
    }
  });

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
function gerarDadosMapa(dados) {
  return dados.slice(0, 1000).map(row => ({
    rubrica: row.RUBRICA,
    bairro: row.BAIRRO,
    municipio: row.MUNICIPIO,
    marca: row.MARCA,
    tipo: row.TIPO_VEICULO,
    data: row.DATA_OCORRENCIA,
    // A primeira coordenada (-15.79...) é a latitude, a segunda (-47.82...) é a longitude
    lat: row.LAT || -15.7925835891468, 
    lng: row.LNG || -47.82216279342462
  }));
}

// Gerar ocorrências recentes
function gerarOcorrenciasRecentes(dados) {
  return dados.slice(0, 100).map(row => ({
    rubrica: row.RUBRICA,
    data: row.DATA_OCORRENCIA,
    municipio: row.MUNICIPIO
  }));
}

// Gerar top bairros
function gerarTopBairros(dados) {
  const bairros = {};
  dados.forEach(row => {
    const bairro = row.BAIRRO || 'DESCONHECIDO';
    bairros[bairro] = (bairros[bairro] || 0) + 1;
  });
  return Object.entries(bairros)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([bairro, count]) => ({ bairro, count }));
}

// Gerar top delegacias
function gerarTopDelegacias(dados) {
  const delegacias = {};
  dados.forEach(row => {
    const delegacia = row.DELEGACIA || 'DESCONHECIDO';
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

  const state = carregarEstado();
  const mesAtual = new Date().getMonth() + 1; // 1-12
  const anoAtual = new Date().getFullYear(); // 2025
  const ultimaAtualizacao = state.ultimaAtualizacao ? new Date(state.ultimaAtualizacao) : null;
  const mesUltima = ultimaAtualizacao ? ultimaAtualizacao.getMonth() + 1 : 0;

  // Determinar anos a processar
  const anosParaProcessar = ANOS.filter(ano => {
    if (!state.anosProcessados.includes(ano)) return true; // Processa anos não mapeados
    if (ano === anoAtual && mesAtual !== mesUltima) return true; // Processa ano atual se mês mudou
    return false;
  });

  if (anosParaProcessar.length === 0) {
    console.log('Nenhum ano novo para processar. Última atualização:', state.ultimaAtualizacao);
    return;
  }

  const todosDados = [];
  for (const ano of anosParaProcessar) {
    const dadosAno = await processarAno(ano);
    todosDados.push(...dadosAno);
  }

  if (todosDados.length === 0) {
    console.error('Nenhum dado novo processado.');
    process.exit(1);
  }

  // Processar em blocos
  processarEmBlocos(todosDados);

  // Atualizar estado
  state.anosProcessados = [...new Set([...state.anosProcessados, ...anosParaProcessar])];
  state.ultimaAtualizacao = new Date().toISOString();
  salvarEstado(state);

  console.log(`Atualização concluída! Total de registros processados: ${todosDados.length}`);
}

main().catch(console.error);