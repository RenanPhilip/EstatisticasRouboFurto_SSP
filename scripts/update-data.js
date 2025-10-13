// scripts/update-data.js - OTIMIZADO PARA BIG DATA
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const XLSX = require('xlsx');

// Colunas essenciais (apenas 15 das 52)
// scripts/update-data.js - OTIMIZADO PARA BIG DATA

// Exemplo de como deve ficar em scripts/update-data.js e scripts/test-local.js

const COLUNAS_ESSENCIAIS = [
  'RUBRICA',
  'DESCR_OCORRENCIA_VEICULO', // OK: Tem 'R'
  'NOME_MUNICIPIO',
  'BAIRRO',
  'NOME_DELEGACIA',
  'DATA_OCORRENCIA_BO',
  'HORA_OCORRENCIA',
  'DESCR_PERIODO',
  'LATITUDE',
  'LONGITUDE',
  'DESCR_TIPO_VEICULO',   // OK: Tem 'R'
  'DESCR_MARCA_VEICULO',  // OK: Tem 'R'
  
  // CORREÇÃO APLICADA AQUI: REMOVENDO O 'R' de 'DESCR'
  'DESC_COR_VEICULO',     // <-- AGORA SEM 'R'
  
  'ANO_FABRICACAO',
  'AUTORIA_BO',
  'FLAG_FLAGRANTE',
  'MES',
  'ANO'
];

// Estatísticas acumuladas (evita guardar tudo na memória)
let estatisticasGlobais = {
  ultimaAtualizacao: new Date().toISOString(),
  totalRegistros: 0,
  porRubrica: {},
  porMunicipio: {},
  porBairro: {},
  porDelegacia: {},
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
  porFlagrante: { sim: 0, nao: 0 },
  ocorrenciasComLocalizacao: [],
  ocorrenciasRecentes: []
};

async function baixarDadosSSP() {
  console.log('🚀 Iniciando download dos dados da SSP-SP...');
  console.log('⚡ Modo OTIMIZADO para Big Data\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    const downloadPath = path.resolve(__dirname, '../temp');
    await fs.mkdir(downloadPath, { recursive: true });
    
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });
    
    const anoAtual = new Date().getFullYear();
    const anos = [anoAtual, anoAtual - 1, anoAtual - 2, anoAtual - 3];
    
    console.log(`📥 Baixando dados de: ${anos.join(', ')}`);
    
    for (const ano of anos) {
      console.log(`\n📥 Acessando dados de ${ano}...`);
      
      await page.goto('https://www.ssp.sp.gov.br/estatistica/dados-mensais', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      const linkXPath = `//a[contains(text(), '${ano}') and contains(text(), 'Veículos')]`;
      
      try {
        await page.waitForXPath(linkXPath, { timeout: 10000 });
        const [linkElement] = await page.$x(linkXPath);
        
        if (linkElement) {
          console.log(`✅ Encontrado link para veículos ${ano}`);
          await linkElement.click();
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      } catch (error) {
        console.log(`⚠️ Não encontrado arquivo para ${ano}`);
      }
    }
    
    // Processa arquivos UM POR VEZ (não todos de uma vez!)
    const files = await fs.readdir(downloadPath);
    const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    
    console.log(`\n📊 Processando ${excelFiles.length} arquivos (um por vez)...\n`);
    
    for (const file of excelFiles) {
      await processarArquivo(path.join(downloadPath, file), file);
      
      // Força coleta de lixo (libera memória)
      if (global.gc) {
        global.gc();
      }
    }
    
    console.log(`\n✅ Total processado: ${estatisticasGlobais.totalRegistros.toLocaleString()} registros`);
    
    // Gera top 10 marcas
    estatisticasGlobais.top10MarcasMaisRoubadas = Object.entries(estatisticasGlobais.porMarcaVeiculo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([marca, count]) => ({ marca, count }));
    
    // Salva resultados
    await salvarDados();
    
    // Limpa arquivos temporários
    for (const file of excelFiles) {
      await fs.unlink(path.join(downloadPath, file));
    }
    
  } catch (error) {
    console.error('❌ Erro ao processar dados:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function processarArquivo(filePath, nomeArquivo) {
  console.log(`\n📂 Processando: ${nomeArquivo}`);
  
  const anoMatch = nomeArquivo.match(/20\d{2}/);
  const anoArquivo = anoMatch ? anoMatch[0] : 'desconhecido';
  
  // Lê arquivo com opções de baixo consumo de memória
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    cellNF: false,
    cellText: false,
    sheetStubs: false // ignora células vazias
  });
  
  let totalLinhasArquivo = 0;
  
  // Processa ABA POR ABA (não todas de uma vez)
  for (const sheetName of workbook.SheetNames) {
    console.log(`   📄 Aba: ${sheetName}...`);
    
    const sheet = workbook.Sheets[sheetName];
    
    // Lê dados em CHUNKS (pedaços) para economizar memória
    const dados = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      defval: null
    });
    
    console.log(`      Linhas: ${dados.length.toLocaleString()}`);
    totalLinhasArquivo += dados.length;
    
    // Processa em LOTES de 10k registros por vez
    const TAMANHO_LOTE = 10000;
    for (let i = 0; i < dados.length; i += TAMANHO_LOTE) {
      const lote = dados.slice(i, i + TAMANHO_LOTE);
      
      lote.forEach(row => {
        // Extrai APENAS colunas essenciais (economiza ~70% de memória)
        const registroOtimizado = {};
        COLUNAS_ESSENCIAIS.forEach(col => {
          registroOtimizado[col] = row[col];
        });
        
        registroOtimizado._ano = anoArquivo;
        registroOtimizado._mes = sheetName;
        
        // Processa estatísticas IMEDIATAMENTE (não guarda na memória)
        processarRegistro(registroOtimizado);
      });
      
      // Log de progresso
      if (i % 50000 === 0 && i > 0) {
        console.log(`      ⏳ Processados ${i.toLocaleString()}...`);
      }
    }
    
    // Limpa variável para liberar memória
    dados.length = 0;
  }
  
  console.log(`   ✅ Total do arquivo: ${totalLinhasArquivo.toLocaleString()} registros`);
}

function processarRegistro(registro) {
  estatisticasGlobais.totalRegistros++;
  
  // Rubrica
  const rubrica = registro.RUBRICA || 'Não informado';
  estatisticasGlobais.porRubrica[rubrica] = (estatisticasGlobais.porRubrica[rubrica] || 0) + 1;
  
  // Município
  const municipio = registro.NOME_MUNICIPIO || 'Não informado';
  estatisticasGlobais.porMunicipio[municipio] = (estatisticasGlobais.porMunicipio[municipio] || 0) + 1;
  
  // Bairro (guarda apenas se tiver valor)
  const bairro = registro.BAIRRO;
  if (bairro && bairro !== 'Não informado') {
    estatisticasGlobais.porBairro[bairro] = (estatisticasGlobais.porBairro[bairro] || 0) + 1;
  }
  
  // Delegacia
  const delegacia = registro.NOME_DELEGACIA || 'Não informado';
  estatisticasGlobais.porDelegacia[delegacia] = (estatisticasGlobais.porDelegacia[delegacia] || 0) + 1;
  
  // Período
  const periodo = registro.DESCR_PERIODO || 'Não informado';
  estatisticasGlobais.porPeriodo[periodo] = (estatisticasGlobais.porPeriodo[periodo] || 0) + 1;
  
  // Data e Hora
  if (registro.DATA_OCORRENCIA_BO) {
    try {
      const data = new Date(registro.DATA_OCORRENCIA_BO);
      if (!isNaN(data.getTime())) {
        const mesAno = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
        estatisticasGlobais.porMesAno[mesAno] = (estatisticasGlobais.porMesAno[mesAno] || 0) + 1;
        
        const ano = data.getFullYear().toString();
        estatisticasGlobais.porAno[ano] = (estatisticasGlobais.porAno[ano] || 0) + 1;
        
        const mes = data.toLocaleString('pt-BR', { month: 'long' });
        estatisticasGlobais.porMes[mes] = (estatisticasGlobais.porMes[mes] || 0) + 1;
        
        const diaSemana = data.toLocaleString('pt-BR', { weekday: 'long' });
        estatisticasGlobais.porDiaSemana[diaSemana] = (estatisticasGlobais.porDiaSemana[diaSemana] || 0) + 1;
      }
    } catch (e) {
      // Ignora datas inválidas
    }
  }
  
  // Hora
  if (registro.HORA_OCORRENCIA) {
    const hora = String(registro.HORA_OCORRENCIA).split(':')[0];
    if (hora && hora.length <= 2) {
      estatisticasGlobais.porHora[hora] = (estatisticasGlobais.porHora[hora] || 0) + 1;
    }
  }
  
  // Tipo de veículo
  const tipoVeiculo = registro.DESCR_TIPO_VEICULO || 'Não informado';
  estatisticasGlobais.porTipoVeiculo[tipoVeiculo] = (estatisticasGlobais.porTipoVeiculo[tipoVeiculo] || 0) + 1;
  
  // Marca (limita armazenamento)
  const marcaVeiculo = registro.DESCR_MARCA_VEICULO;
  if (marcaVeiculo && marcaVeiculo !== 'Não informado') {
    estatisticasGlobais.porMarcaVeiculo[marcaVeiculo] = (estatisticasGlobais.porMarcaVeiculo[marcaVeiculo] || 0) + 1;
  }
  
  // Cor
  const corVeiculo = registro.DESCR_COR_VEICULO || 'Não informado';
  estatisticasGlobais.porCorVeiculo[corVeiculo] = (estatisticasGlobais.porCorVeiculo[corVeiculo] || 0) + 1;
  
  // Ano de fabricação
  const anoFab = parseInt(registro.ANO_FABRICACAO);
  if (anoFab && anoFab > 1950 && anoFab <= new Date().getFullYear()) {
    estatisticasGlobais.porAnoFabricacao[anoFab] = (estatisticasGlobais.porAnoFabricacao[anoFab] || 0) + 1;
  }
  
  // Autoria
  const autoria = (registro.AUTORIA_BO || '').toLowerCase();
  if (autoria.includes('conhecida')) {
    estatisticasGlobais.porAutoria.conhecida++;
  } else if (autoria.includes('desconhecida')) {
    estatisticasGlobais.porAutoria.desconhecida++;
  }
  
  // Flagrante
  if (registro.FLAG_FLAGRANTE === 'S') {
    estatisticasGlobais.porFlagrante.sim++;
  } else if (registro.FLAG_FLAGRANTE === 'N') {
    estatisticasGlobais.porFlagrante.nao++;
  }
  
  // Localização (guarda apenas últimos 20k com coordenadas válidas)
  if (registro.LATITUDE && registro.LONGITUDE) {
    const lat = parseFloat(registro.LATITUDE);
    const lng = parseFloat(registro.LONGITUDE);
    
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      // Mantém apenas últimos 20k (FIFO - First In First Out)
      if (estatisticasGlobais.ocorrenciasComLocalizacao.length >= 20000) {
        estatisticasGlobais.ocorrenciasComLocalizacao.shift(); // remove primeiro
      }
      
      estatisticasGlobais.ocorrenciasComLocalizacao.push({
        lat,
        lng,
        rubrica,
        municipio: registro.NOME_MUNICIPIO,
        bairro: registro.BAIRRO,
        data: registro.DATA_OCORRENCIA_BO,
        marca: marcaVeiculo,
        tipo: tipoVeiculo
      });
    }
  }
  
  // Ocorrências recentes (últimos 10k para análise detalhada)
  if (estatisticasGlobais.ocorrenciasRecentes.length < 10000) {
    estatisticasGlobais.ocorrenciasRecentes.push({
      data: registro.DATA_OCORRENCIA_BO,
      hora: registro.HORA_OCORRENCIA,
      rubrica: registro.RUBRICA,
      municipio: registro.NOME_MUNICIPIO,
      bairro: registro.BAIRRO,
      delegacia: registro.NOME_DELEGACIA,
      tipoVeiculo: registro.DESCR_TIPO_VEICULO,
      marcaVeiculo: registro.DESCR_MARCA_VEICULO,
      corVeiculo: registro.DESCR_COR_VEICULO,
      anoFabricacao: registro.ANO_FABRICACAO,
      latitude: registro.LATITUDE,
      longitude: registro.LONGITUDE
    });
  }
}

async function salvarDados() {
  const dataDir = path.resolve(__dirname, '../data');
  await fs.mkdir(dataDir, { recursive: true });
  
  console.log('\n💾 Salvando arquivos...');
  
  // Estatísticas principais (otimizado)
  await fs.writeFile(
    path.join(dataDir, 'estatisticas.json'),
    JSON.stringify({
      ultimaAtualizacao: estatisticasGlobais.ultimaAtualizacao,
      totalRegistros: estatisticasGlobais.totalRegistros,
      porRubrica: estatisticasGlobais.porRubrica,
      porMunicipio: estatisticasGlobais.porMunicipio,
      porPeriodo: estatisticasGlobais.porPeriodo,
      porMesAno: estatisticasGlobais.porMesAno,
      porAno: estatisticasGlobais.porAno,
      porMes: estatisticasGlobais.porMes,
      porDiaSemana: estatisticasGlobais.porDiaSemana,
      porHora: estatisticasGlobais.porHora,
      porTipoVeiculo: estatisticasGlobais.porTipoVeiculo,
      porCorVeiculo: estatisticasGlobais.porCorVeiculo,
      porAnoFabricacao: estatisticasGlobais.porAnoFabricacao,
      top10MarcasMaisRoubadas: estatisticasGlobais.top10MarcasMaisRoubadas,
      porAutoria: estatisticasGlobais.porAutoria,
      porFlagrante: estatisticasGlobais.porFlagrante
    }, null, 2)
  );
  
  // Top bairros (100 maiores)
  const topBairros = Object.entries(estatisticasGlobais.porBairro)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);
  
  await fs.writeFile(
    path.join(dataDir, 'top-bairros.json'),
    JSON.stringify(topBairros, null, 2)
  );
  
  // Top delegacias (50 maiores)
  const topDelegacias = Object.entries(estatisticasGlobais.porDelegacia)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);
  
  await fs.writeFile(
    path.join(dataDir, 'top-delegacias.json'),
    JSON.stringify(topDelegacias, null, 2)
  );
  
  // Mapa de ocorrências (20k pontos)
  await fs.writeFile(
    path.join(dataDir, 'mapa-ocorrencias.json'),
    JSON.stringify(estatisticasGlobais.ocorrenciasComLocalizacao, null, 2)
  );
  
  // Ocorrências recentes (10k)
  await fs.writeFile(
    path.join(dataDir, 'ocorrencias-recentes.json'),
    JSON.stringify(estatisticasGlobais.ocorrenciasRecentes, null, 2)
  );
  
  console.log('✅ Todos os arquivos salvos com sucesso!');
  console.log(`   📊 estatisticas.json`);
  console.log(`   🏘️  top-bairros.json (top 100)`);
  console.log(`   🏢 top-delegacias.json (top 50)`);
  console.log(`   🗺️  mapa-ocorrencias.json (${estatisticasGlobais.ocorrenciasComLocalizacao.length.toLocaleString()} pontos)`);
  console.log(`   📋 ocorrencias-recentes.json (${estatisticasGlobais.ocorrenciasRecentes.length.toLocaleString()} registros)`);
}

// Executa com mais memória disponível
baixarDadosSSP().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});