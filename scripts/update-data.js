// scripts/update-data.js - PROCESSAMENTO INCREMENTAL MÊS A MÊS
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ==================== CONFIGURAÇÃO ====================
const hoje = new Date();
const anoAtual = hoje.getFullYear();
const mesAtual = hoje.getMonth() + 1; // 1-12

// Calcula mês anterior (pode ser de outro ano)
let anoAnterior = anoAtual;
let mesAnterior = mesAtual - 1;
if (mesAnterior === 0) {
  mesAnterior = 12;
  anoAnterior = anoAtual - 1;
}

const ANOS = [anoAtual, anoAtual - 1, anoAtual - 2]; // [2025, 2024, 2023]
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'processing-state.json');
const BASE_URL = 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub';

// Timeout de 5 minutos
const AXIOS_TIMEOUT = 300000;

// Colunas que realmente vamos usar (otimização!)
const COLUNAS_USAR = [
  'RUBRICA',
  'NOME_MUNICIPIO',
  'BAIRRO',
  'DESCR_PERIODO',
  'DATA_OCORRENCIA_BO',
  'HORA_OCORRENCIA',
  'DESCR_TIPO_VEICULO',
  'DESCR_MARCA_VEICULO',
  'DESC_COR_VEICULO',
  'ANO_FABRICACAO',
  'AUTORIA_BO',
  'FLAG_FLAGRANTE',
  'LATITUDE',
  'LONGITUDE'
];

// Mapeamento de nomes de meses
const MESES_NOME = {
  1: 'JANEIRO', 2: 'FEVEREIRO', 3: 'MARÇO', 4: 'ABRIL',
  5: 'MAIO', 6: 'JUNHO', 7: 'JULHO', 8: 'AGOSTO',
  9: 'SETEMBRO', 10: 'OUTUBRO', 11: 'NOVEMBRO', 12: 'DEZEMBRO'
};

// ==================== ESTADO PERSISTENTE ====================
function carregarEstado() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      console.log(`📂 Estado carregado: ${Object.keys(state.mesesProcessados).length} meses já processados`);
      return state;
    } catch (error) {
      console.log('⚠️ Erro ao ler estado. Criando novo.');
    }
  }
  return {
    mesesProcessados: {}, // { '2025-10': { hash: 'xxx', registros: 1234, dataProcessamento: '...' } }
    ultimaAtualizacao: null
  };
}

function salvarEstado(state) {
  state.ultimaAtualizacao = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ==================== HASH SIMPLES ====================
function calcularHash(dados) {
  // Hash simples baseado em quantidade e amostra
  const sample = dados.length > 10 
    ? JSON.stringify([dados[0], dados[Math.floor(dados.length/2)], dados[dados.length-1]])
    : JSON.stringify(dados);
  return `${dados.length}-${sample.length}`;
}

// ==================== VERIFICAÇÃO DE ATUALIZAÇÃO ====================
function precisaAtualizar(ano, mes, state) {
  const mesAnoKey = `${ano}-${String(mes).padStart(2, '0')}`;
  
  // Mês atual: SEMPRE atualiza (pode ter novos dados)
  if (ano === anoAtual && mes === mesAtual) {
    console.log(`   🔄 ${MESES_NOME[mes]}/${ano}: Mês ATUAL - Sempre atualiza`);
    return true;
  }
  
  // Mês anterior: SEMPRE atualiza (dados retroativos)
  if (ano === anoAnterior && mes === mesAnterior) {
    console.log(`   🔄 ${MESES_NOME[mes]}/${ano}: Mês ANTERIOR - Atualiza por segurança`);
    return true;
  }
  
  // Outros meses: Verifica se já foi processado
  if (state.mesesProcessados[mesAnoKey]) {
    console.log(`   ✅ ${MESES_NOME[mes]}/${ano}: Já processado (IMUTÁVEL) - Pulando`);
    return false;
  }
  
  console.log(`   🆕 ${MESES_NOME[mes]}/${ano}: Nunca processado - Processar`);
  return true;
}

// ==================== DOWNLOAD COM RETRY ====================
async function baixarArquivo(ano, maxRetries = 3) {
  const url = `${BASE_URL}/VeiculosSubtraidos_${ano}.xlsx`;
  
  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    try {
      console.log(`📥 [Tentativa ${tentativa}/${maxRetries}] Baixando ${ano}...`);
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: AXIOS_TIMEOUT,
        maxContentLength: 500 * 1024 * 1024,
        maxBodyLength: 500 * 1024 * 1024
      });
      
      const sizeMB = (response.data.length / 1024 / 1024).toFixed(2);
      console.log(`✅ Download de ${ano} concluído (${sizeMB} MB)`);
      return response.data;
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️ Arquivo ${ano} não encontrado (404)`);
        return null;
      }
      
      if (tentativa === maxRetries) {
        console.error(`❌ Erro após ${maxRetries} tentativas:`, error.message);
        return null;
      }
      
      const aguardar = tentativa * 20000; // 20s, 40s, 60s
      console.log(`⏳ Aguardando ${aguardar/1000}s antes de tentar novamente...`);
      await new Promise(resolve => setTimeout(resolve, aguardar));
    }
  }
  return null;
}

// ==================== PROCESSAMENTO OTIMIZADO POR MÊS ====================
function processarMesEspecifico(workbook, nomeMes) {
  // Encontra a aba (case-insensitive)
  const abaEncontrada = workbook.SheetNames.find(nome => 
    nome.toUpperCase() === nomeMes.toUpperCase()
  );
  
  if (!abaEncontrada) {
    return null;
  }
  
  const sheet = workbook.Sheets[abaEncontrada];
  
  // OTIMIZAÇÃO: Lê apenas as colunas necessárias
  const dadosCompletos = XLSX.utils.sheet_to_json(sheet, { 
    raw: false,
    defval: null
  });
  
  if (dadosCompletos.length === 0) {
    return null;
  }
  
  // Filtra apenas colunas que vamos usar (economia de memória!)
  const dadosOtimizados = dadosCompletos.map(row => {
    const rowOtimizada = {};
    COLUNAS_USAR.forEach(col => {
      if (row.hasOwnProperty(col)) {
        rowOtimizada[col] = row[col];
      }
    });
    return rowOtimizada;
  });
  
  console.log(`      📊 ${dadosOtimizados.length} registros carregados`);
  return dadosOtimizados;
}

// ==================== AGREGAÇÃO ====================
function agregarEstatisticas(dados) {
  const stats = {
    totalRegistros: dados.length,
    porRubrica: {},
    porMunicipio: {},
    porBairro: {},
    porPeriodo: {},
    porMesAno: {},
    porAno: {},
    porMes: {},
    porDiaSemana: {},
    porHora: {},
    porTipoVeiculo: {},
    porMarcaVeiculo: {},
    porCorVeiculo: {},
    porAnoFabricacao: {},
    porAutoria: { conhecida: 0, desconhecida: 0 },
    porFlagrante: { sim: 0, nao: 0 }
  };

  const marcasCount = {};

  dados.forEach(row => {
    // RUBRICA
    const rubrica = String(row.RUBRICA || 'DESCONHECIDO').toUpperCase();
    stats.porRubrica[rubrica] = (stats.porRubrica[rubrica] || 0) + 1;

    // MUNICÍPIO
    const municipio = String(row.NOME_MUNICIPIO || 'DESCONHECIDO').toUpperCase();
    stats.porMunicipio[municipio] = (stats.porMunicipio[municipio] || 0) + 1;

    // BAIRRO
    const bairro = String(row.BAIRRO || 'DESCONHECIDO').toUpperCase();
    stats.porBairro[bairro] = (stats.porBairro[bairro] || 0) + 1;

    // PERÍODO
    const periodo = String(row.DESCR_PERIODO || 'DESCONHECIDO').toUpperCase();
    stats.porPeriodo[periodo] = (stats.porPeriodo[periodo] || 0) + 1;

    // DATA
    if (row.DATA_OCORRENCIA_BO) {
      const data = new Date(row.DATA_OCORRENCIA_BO);
      if (!isNaN(data)) {
        const ano = data.getFullYear();
        const mes = data.getMonth() + 1;
        const mesAno = `${String(mes).padStart(2, '0')}/${ano}`;
        const diaSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][data.getDay()];

        stats.porAno[ano] = (stats.porAno[ano] || 0) + 1;
        stats.porMes[mes] = (stats.porMes[mes] || 0) + 1;
        stats.porMesAno[mesAno] = (stats.porMesAno[mesAno] || 0) + 1;
        stats.porDiaSemana[diaSemana] = (stats.porDiaSemana[diaSemana] || 0) + 1;
      }
    }

    // HORA
    if (row.HORA_OCORRENCIA) {
      const hora = String(row.HORA_OCORRENCIA).split(':')[0].padStart(2, '0');
      stats.porHora[hora] = (stats.porHora[hora] || 0) + 1;
    }

    // VEÍCULO
    const tipoVeiculo = String(row.DESCR_TIPO_VEICULO || 'DESCONHECIDO').toUpperCase();
    stats.porTipoVeiculo[tipoVeiculo] = (stats.porTipoVeiculo[tipoVeiculo] || 0) + 1;

    const marca = String(row.DESCR_MARCA_VEICULO || 'DESCONHECIDO').toUpperCase();
    stats.porMarcaVeiculo[marca] = (stats.porMarcaVeiculo[marca] || 0) + 1;
    
    if (rubrica.includes('ROUBO')) {
      marcasCount[marca] = (marcasCount[marca] || 0) + 1;
    }

    const cor = String(row.DESC_COR_VEICULO || 'DESCONHECIDO').toUpperCase();
    stats.porCorVeiculo[cor] = (stats.porCorVeiculo[cor] || 0) + 1;

    if (row.ANO_FABRICACAO) {
      const anoFab = String(row.ANO_FABRICACAO);
      stats.porAnoFabricacao[anoFab] = (stats.porAnoFabricacao[anoFab] || 0) + 1;
    }

    // AUTORIA E FLAGRANTE
    const autoria = String(row.AUTORIA_BO || '').toUpperCase();
    if (autoria.includes('CONHECIDA')) {
      stats.porAutoria.conhecida++;
    } else {
      stats.porAutoria.desconhecida++;
    }

    const flagrante = String(row.FLAG_FLAGRANTE || '').toUpperCase();
    if (flagrante === 'S') {
      stats.porFlagrante.sim++;
    } else {
      stats.porFlagrante.nao++;
    }
  });

  // Top 10 marcas
  const top10Marcas = Object.entries(marcasCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([marca, count]) => ({ marca, count }));
  
  stats.top10MarcasMaisRoubadas = top10Marcas;

  return stats;
}

function gerarDadosMapa(dados) {
  return dados
    .filter(row => row.LATITUDE && row.LONGITUDE)
    .slice(0, 5000) // 5k pontos por mês
    .map(row => ({
      rubrica: row.RUBRICA,
      bairro: row.BAIRRO,
      municipio: row.NOME_MUNICIPIO,
      marca: row.DESCR_MARCA_VEICULO,
      tipo: row.DESCR_TIPO_VEICULO,
      data: row.DATA_OCORRENCIA_BO,
      lat: parseFloat(row.LATITUDE),
      lng: parseFloat(row.LONGITUDE)
    }));
}

// ==================== MERGE DE DADOS ====================
function mergeEstatisticas(antiga, nova) {
  const merged = JSON.parse(JSON.stringify(antiga)); // Clone profundo
  
  // Soma campos numéricos
  merged.totalRegistros = (antiga.totalRegistros || 0) + (nova.totalRegistros || 0);
  
  // Merge objetos contadores
  ['porRubrica', 'porMunicipio', 'porBairro', 'porPeriodo', 'porMesAno', 
   'porAno', 'porMes', 'porDiaSemana', 'porHora', 'porTipoVeiculo', 
   'porMarcaVeiculo', 'porCorVeiculo', 'porAnoFabricacao'].forEach(key => {
    merged[key] = merged[key] || {};
    Object.entries(nova[key] || {}).forEach(([k, v]) => {
      merged[key][k] = (merged[key][k] || 0) + v;
    });
  });
  
  // Merge autoria e flagrante
  merged.porAutoria.conhecida = (antiga.porAutoria?.conhecida || 0) + nova.porAutoria.conhecida;
  merged.porAutoria.desconhecida = (antiga.porAutoria?.desconhecida || 0) + nova.porAutoria.desconhecida;
  merged.porFlagrante.sim = (antiga.porFlagrante?.sim || 0) + nova.porFlagrante.sim;
  merged.porFlagrante.nao = (antiga.porFlagrante?.nao || 0) + nova.porFlagrante.nao;
  
  // Recalcula top 10 marcas
  const todasMarcas = {};
  [...(antiga.top10MarcasMaisRoubadas || []), ...nova.top10MarcasMaisRoubadas].forEach(item => {
    todasMarcas[item.marca] = (todasMarcas[item.marca] || 0) + item.count;
  });
  merged.top10MarcasMaisRoubadas = Object.entries(todasMarcas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([marca, count]) => ({ marca, count }));
  
  merged.ultimaAtualizacao = new Date().toISOString();
  
  return merged;
}

function removerMesEspecifico(estatisticasAntigas, ano, mes) {
  // Remove estatísticas do mês específico antes de adicionar novamente
  const mesAnoKey = `${String(mes).padStart(2, '0')}/${ano}`;
  const stats = JSON.parse(JSON.stringify(estatisticasAntigas));
  
  if (stats.porMesAno && stats.porMesAno[mesAnoKey]) {
    delete stats.porMesAno[mesAnoKey];
  }
  
  return stats;
}

// ==================== MAIN ====================
async function main() {
  console.log('\n🚀 Iniciando processamento SSP-SP (INCREMENTAL MÊS A MÊS)\n');
  console.log(`📅 Data de Execução: ${hoje.toLocaleDateString('pt-BR')}`);
  console.log(`🔄 Mês ATUAL: ${MESES_NOME[mesAtual]}/${anoAtual} (SEMPRE atualiza)`);
  console.log(`🔄 Mês ANTERIOR: ${MESES_NOME[mesAnterior]}/${anoAnterior} (SEMPRE atualiza)`);
  console.log(`✅ Outros meses: Apenas se nunca processados (IMUTÁVEIS)\n`);
  
  // Garante que pasta data existe
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  const state = carregarEstado();
  
  let estatisticasGlobais = null;
  let dadosMapa = [];
  
  // Carrega dados existentes
  const estatisticasPath = path.join(DATA_DIR, 'estatisticas.json');
  const mapaPath = path.join(DATA_DIR, 'mapa-ocorrencias.json');
  
  if (fs.existsSync(estatisticasPath)) {
    console.log('📂 Carregando estatísticas existentes...');
    estatisticasGlobais = JSON.parse(fs.readFileSync(estatisticasPath, 'utf8'));
  }
  
  if (fs.existsSync(mapaPath)) {
    console.log('📂 Carregando mapa existente...');
    dadosMapa = JSON.parse(fs.readFileSync(mapaPath, 'utf8'));
  }
  
  let algumMesProcessado = false;
  
  // ===== PROCESSAR ANOS DO MAIS RECENTE PARA O MAIS ANTIGO =====
  for (const ano of ANOS) {
    console.log(`\n📅 ========== ANO: ${ano} ==========`);
    
    // Verifica se há meses a processar neste ano
    let temMesesParaProcessar = false;
    for (let mes = 12; mes >= 1; mes--) {
      if (precisaAtualizar(ano, mes, state)) {
        temMesesParaProcessar = true;
        break;
      }
    }
    
    if (!temMesesParaProcessar) {
      console.log(`   ✅ Todos os meses de ${ano} já processados. Pulando ano inteiro.`);
      continue;
    }
    
    // Baixa o arquivo do ano inteiro UMA VEZ
    const buffer = await baixarArquivo(ano);
    
    if (!buffer) {
      console.log(`   ⚠️ Não foi possível baixar ${ano}. Pulando.`);
      continue;
    }
    
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    // Processa mês por mês (do mais recente para o mais antigo)
    for (let mes = 12; mes >= 1; mes--) {
      const mesAnoKey = `${ano}-${String(mes).padStart(2, '0')}`;
      const nomeMes = MESES_NOME[mes];
      
      console.log(`\n   📆 Verificando ${nomeMes}/${ano}...`);
      
      // Verifica se precisa atualizar
      if (!precisaAtualizar(ano, mes, state)) {
        continue;
      }
      
      // Se for mês atual ou anterior, remove dados antigos antes de adicionar novos
      const ehMesAtualOuAnterior = 
        (ano === anoAtual && mes === mesAtual) || 
        (ano === anoAnterior && mes === mesAnterior);
      
      if (ehMesAtualOuAnterior && estatisticasGlobais) {
        console.log(`      🔄 Removendo dados antigos de ${nomeMes}/${ano} para reatualizar...`);
        estatisticasGlobais = removerMesEspecifico(estatisticasGlobais, ano, mes);
        
        // Remove pontos do mapa desse mês
        dadosMapa = dadosMapa.filter(p => {
          if (!p.data) return true;
          const dataPonto = new Date(p.data);
          return !(dataPonto.getFullYear() === ano && dataPonto.getMonth() + 1 === mes);
        });
      }
      
      // Processa o mês
      const dadosMes = processarMesEspecifico(workbook, nomeMes);
      
      if (!dadosMes || dadosMes.length === 0) {
        console.log(`      ⚠️ ${nomeMes}/${ano} vazio ou não encontrado. Pulando.`);
        continue;
      }
      
      // Agrega estatísticas
      const estatisticasMes = agregarEstatisticas(dadosMes);
      const mapaMes = gerarDadosMapa(dadosMes);
      
      // Merge com dados existentes
      if (estatisticasGlobais) {
        estatisticasGlobais = mergeEstatisticas(estatisticasGlobais, estatisticasMes);
      } else {
        estatisticasGlobais = estatisticasMes;
        estatisticasGlobais.ultimaAtualizacao = new Date().toISOString();
      }
      
      // Adiciona pontos do mapa (mais recentes primeiro)
      dadosMapa = [...mapaMes, ...dadosMapa].slice(0, 20000);
      
      // Salva incrementalmente
      fs.writeFileSync(estatisticasPath, JSON.stringify(estatisticasGlobais, null, 2));
      fs.writeFileSync(mapaPath, JSON.stringify(dadosMapa, null, 2));
      
      // Atualiza estado
      const hash = calcularHash(dadosMes);
      state.mesesProcessados[mesAnoKey] = {
        hash,
        registros: dadosMes.length,
        dataProcessamento: new Date().toISOString()
      };
      salvarEstado(state);
      
      algumMesProcessado = true;
      console.log(`      ✅ ${nomeMes}/${ano} processado e salvo (${dadosMes.length} registros)`);
    }
  }
  
  if (!algumMesProcessado) {
    console.log('\n✅ Nenhum mês novo para processar. Dados já estão atualizados!');
  }
  
  // Gera arquivos auxiliares
  if (estatisticasGlobais) {
    console.log('\n📦 Gerando arquivos auxiliares...');
    
    // Top Bairros
    const topBairros = Object.entries(estatisticasGlobais.porBairro)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([bairro, count]) => ({ bairro, count }));
    fs.writeFileSync(path.join(DATA_DIR, 'top-bairros.json'), JSON.stringify(topBairros, null, 2));
    
    // Top Municípios
    const topMunicipios = Object.entries(estatisticasGlobais.porMunicipio)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([municipio, count]) => ({ municipio, count }));
    fs.writeFileSync(path.join(DATA_DIR, 'top-delegacias.json'), JSON.stringify(topMunicipios, null, 2));
    
    // Ocorrências recentes (últimos 10k do mapa)
    const recentes = dadosMapa.slice(0, 10000);
    fs.writeFileSync(path.join(DATA_DIR, 'ocorrencias-recentes.json'), JSON.stringify(recentes, null, 2));
    
    console.log('   ✅ Arquivos auxiliares gerados.');
  }
  
  console.log('\n🎉 Processamento concluído com sucesso!');
  console.log(`📊 Total de meses processados historicamente: ${Object.keys(state.mesesProcessados).length}`);
  console.log(`📊 Total de registros no banco: ${estatisticasGlobais?.totalRegistros.toLocaleString('pt-BR') || 0}\n`);
}

main().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});