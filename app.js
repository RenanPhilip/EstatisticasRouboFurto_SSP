// app.js - Dashboard Analytics Completo com validação

let dadosEstatisticas = null;
let dadosMapa = null;
let mapInstance = null;
let charts = {};

Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';

async function carregarDados() {
  try {
    console.log('Carregando dados...');
    
    // Carrega estatísticas gerais
    const respEstatisticas = await fetch('./data/estatisticas.json');
    if (!respEstatisticas.ok) throw new Error('Estatísticas não encontrado');
    
    const textoEst = await respEstatisticas.text();
    
    // Valida se é JSON válido (não ponteiro LFS)
    if (textoEst.includes('git-lfs') || textoEst.includes('version https://git-lfs')) {
      throw new Error('Arquivo é ponteiro LFS (dados ainda sendo processados)');
    }
    
    dadosEstatisticas = JSON.parse(textoEst);
    
    if (!dadosEstatisticas || !dadosEstatisticas.totalRegistros) {
      throw new Error('Dados inválidos ou vazios');
    }
    
    // Carrega mapa de ocorrencia Lng Lat
    const respMapa = await fetch('data/mapa-ocorrencias.json');
    if (respMapa.ok) {
      const textoMapa = await respMapa.text();
      if (!textoMapa.includes('git-lfs')) {
        dadosMapa = JSON.parse(textoMapa);
      }
    }
    
    // Atualiza interface do cabeçalho
    const dataAtualizacao = new Date(dadosEstatisticas.ultimaAtualizacao);
    document.getElementById('updateInfo').innerHTML = `
      <strong>Última atualização:</strong> ${dataAtualizacao.toLocaleDateString('pt-BR')} às ${dataAtualizacao.toLocaleTimeString('pt-BR')}
      <br><strong>Total de registros:</strong> ${dadosEstatisticas.totalRegistros.toLocaleString('pt-BR')}
    `;
    
    popularFiltros();
    atualizarCards();
    criarTodosGraficos();
    
    if (dadosMapa && dadosMapa.length > 0) {
      inicializarMapa();
    }

    document.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', aplicarFiltros);
    });
    
    document.querySelectorAll('.map-controls input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', atualizarMapa);
    });
    
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    document.querySelector('.container').insertAdjacentHTML('afterbegin', `
      <div class="error">
        ⚠️ ${error.message}
        <br><small>Os dados estão sendo processados. Atualize a página em alguns minutos.</small>
      </div>
    `);
  }
}

// melhorar isso (FILTROS)
function popularFiltros() {
  const anos = Object.keys(dadosEstatisticas.porAno).sort((a, b) => b - a);
  const yearFilter = document.getElementById('yearFilter');
  anos.forEach(ano => {
    const option = document.createElement('option');
    option.value = ano;
    option.textContent = ano;
    yearFilter.appendChild(option);
  });
  
  const municipios = Object.entries(dadosEstatisticas.porMunicipio)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  const municipioFilter = document.getElementById('municipioFilter');
  municipios.forEach(([municipio]) => {
    const option = document.createElement('option');
    option.value = municipio;
    option.textContent = municipio;
    municipioFilter.appendChild(option);
  });
  
  const rubricas = Object.keys(dadosEstatisticas.porRubrica);
  const rubricaFilter = document.getElementById('rubricaFilter');
  rubricas.forEach(rubrica => {
    const option = document.createElement('option');
    option.value = rubrica;
    option.textContent = rubrica;
    rubricaFilter.appendChild(option);
  });

  // Novos filtros
  const tiposVeiculo = Object.keys(dadosEstatisticas.porTipoVeiculo);
  const tipoVeiculoFilter = document.getElementById('tipoVeiculoFilter');
  tiposVeiculo.forEach(tipo => {
    const option = document.createElement('option');
    option.value = tipo;
    option.textContent = tipo;
    tipoVeiculoFilter.appendChild(option);
  });

  const coresVeiculo = Object.keys(dadosEstatisticas.porCorVeiculo);
  const corVeiculoFilter = document.getElementById('corVeiculoFilter');
  coresVeiculo.forEach(cor => {
    const option = document.createElement('option');
    option.value = cor;
    option.textContent = cor;
    corVeiculoFilter.appendChild(option);
  });
}

// Cards de cabeçalho
function atualizarCards() {
  const totalGeral = dadosEstatisticas.totalRegistros || 'N/A';
  const anosAnalisados = `${Object.keys(dadosEstatisticas.porAno)[Object.keys(dadosEstatisticas.porAno).length - 1]} - ${Object.keys(dadosEstatisticas.porAno)[0]}` || 'N/A';
  
  const totalFlagrantes = dadosEstatisticas.porFlagrante.sim + dadosEstatisticas.porFlagrante.nao;
  const percFlagrantes = totalFlagrantes > 0 ? ((dadosEstatisticas.porFlagrante.sim / totalFlagrantes) * 100).toFixed(1) : 0;

  document.getElementById('totalGeral').textContent = totalGeral.toLocaleString('pt-BR');
  document.getElementById('anosAnalisados').textContent = anosAnalisados.toLocaleString('pt-BR') || 'N/A';
  document.getElementById('totalMunicipios').textContent = Object.keys(dadosEstatisticas.porMunicipio).length;
  document.getElementById('totalFlagrantes').textContent = `${percFlagrantes}%`;
}

// Cria todos os graficos
function criarTodosGraficos() {
  criarGraficoTimeline();
  criarGraficoHoras();
  criarGraficoMarcas();
  criarGraficoDiaSemana();
  criarGraficoTipoVeiculo();
  criarGraficoCores();
  criarGraficoMunicipios();
  criarGraficoBairros();
  criarGraficoPeriodo();
}

// Função auxiliar para reestruturar os dados de AAAA/MM para Múltiplos Datasets
function reestruturarDadosPorAno(dados) {
  const dadosPorAno = {};
  const anos = new Set();
  // Cria um array com os meses de '01' a '12' para o eixo X
  const meses = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  // 1. Agrupar os dados por Ano e Mês (MM)
  Object.entries(dados.porMesAno).forEach(([mesAno, valor]) => {
    // Assume o formato AAAA/MM
    const [ano, mes] = mesAno.split('/');
    anos.add(ano);

    if (!dadosPorAno[ano]) {
      dadosPorAno[ano] = {};
    }
    // Armazena o valor indexado pelo Mês (MM)
    dadosPorAno[ano][mes] = valor;
  });

  // 2. Cria uma lista de anos ordenados
  const anosOrdenados = Array.from(anos).sort();

  return { dadosPorAno, anosOrdenados, meses };
}

function criarGraficoTimeline() {
  const ctx = document.getElementById('monthlyChart')?.getContext('2d');
  if (!ctx) return;
  
  // Lista de cores para garantir diferenciação visual (adicione mais se necessário)
  const coresCiclicas = [
    '#3b82f6', // Azul (ex: 2023)
    '#ef4444', // Vermelho (ex: 2024)
    '#10b981', // Verde (ex: 2022)
    '#f59e0b', // Amarelo/Laranja (ex: 2021)
    '#a855f7', // Roxo (ex: 2020)
    '#64748b'  // Cinza
  ];

  // Estrutura os dados
  const { dadosPorAno, anosOrdenados, meses } = reestruturarDadosPorAno(dadosEstatisticas);

  // Mapeia os anos para criar os Datasets
  const datasets = anosOrdenados.map((ano, index) => {
    // Usa null para meses sem dados. Isso garante que as linhas futuras não sejam plotadas.
    const dadosDoAno = meses.map(mes => dadosPorAno[ano][mes] || null);
    const cor = coresCiclicas[index % coresCiclicas.length];

    return {
      label: `Ano ${ano}`,
      data: dadosDoAno,
      borderColor: cor,
      backgroundColor: 'transparent', // Linhas separadas não precisam de preenchimento
      tension: 0.1, // Linhas mais suaves
      fill: false,
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: cor,
      pointBorderColor: '#fff',
      pointHoverRadius: 6
    };
  });

  // Os rótulos do eixo X são apenas os 12 meses
  const labelsDoEixoX = meses.map(mes => `Mês ${mes}`);

  // Destruir o gráfico existente antes de criar um novo (se aplicável)
  if (charts.timeline) {
    charts.timeline.destroy();
  }
  
  charts.timeline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labelsDoEixoX, // Eixo X de Mês 01 a Mês 12
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { 
                display: true,
                position: 'top',
                labels: {
                    color: '#000000ff', // Cor da fonte (se for fundo escuro)
                    
                    // =======================================================
                    // 1. ALTERAÇÃO PRINCIPAL: Preencher a caixa de cor (useBoxPadding)
                    // Define se a forma na legenda deve ser preenchida.
                    usePointStyle: true, // Garante que continue sendo uma caixa (ou retangular)
                    useBorderRadius: true, // Adiciona bordas suaves (opcional, mas fica bonito)
                    
                    // 2. Aumentar o Tamanho e Espaçamento
                    boxWidth: 60,     // Aumenta a largura da caixa de cor (padrão é 40)
                    boxHeight: 40,    // Aumenta a altura da caixa de cor
                    padding: 30,      // Aumenta o espaço entre os itens da legenda
                    font: {
                        size: 15,     // Aumenta o tamanho da fonte do texto na legenda
                        //weight: 'bold' // Deixa o texto em negrito (opcional, mas melhora a visibilidade)
                    },
                    // =======================================================
                }
            },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            // Formata o título do tooltip para mostrar o Ano
            title: function (context) {
              const mes = labelsDoEixoX[context[0].dataIndex];
              const ano = context[0].dataset.label.replace('Ano ', '');
              return `${mes} de ${ano}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.1)' } // Grid mais sutil
        },
        x: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8' // Cor dos rótulos do eixo X
          }
        }
      }
    }

  });
}

function criarGraficoHoras() {
  const ctx = document.getElementById('hourChart')?.getContext('2d');
  if (!ctx) return;
  
  const horas = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const valores = horas.map(h => dadosEstatisticas.porHora[h] || 0);
  
  charts.hour = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [{
        label: 'Ocorrências',
        data: valores,
        backgroundColor: valores.map((v, i) => {
          const max = Math.max(...valores);
          const intensity = v / max;
          return `rgba(139, 92, 246, ${0.3 + intensity * 0.7})`;
        }),
        borderColor: '#8b5cf6',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#334155' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function criarGraficoMarcas() {
  const ctx = document.getElementById('marcasChart')?.getContext('2d');
  if (!ctx) return;
  
  const top10 = dadosEstatisticas.top10MarcasMaisRoubadas || [];
  
  charts.marcas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top10.map(m => m.marca || 'Desconhecido'),
      datasets: [{
        label: 'Ocorrências',
        data: top10.map(m => m.count || 0),
        backgroundColor: 'rgba(236, 72, 153, 0.7)',
        borderColor: '#ec4899',
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: '#334155' } },
        y: { grid: { display: false } }
      }
    }
  });
}

function criarGraficoPeriodo() {
  const ctx = document.getElementById('periodoChart')?.getContext('2d');
  if (!ctx) return;
  
  const periodos = Object.entries(dadosEstatisticas.porPeriodo || {})
    .sort((a, b) => b[1] - a[1]);
  
  if (periodos.length === 0) return;
  
  charts.periodo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: periodos.map(([k]) => k),
      datasets: [{
        label: 'Ocorrências',
        data: periodos.map(([, v]) => v),
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
        borderColor: '#f59e0b',
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: '#334155' } },
        y: { grid: { display: false } }
      }
    }
  });
}

let markerLayers = {};

function inicializarMapa() {
  // mapInstance = L.map('map').setView([-23.54731471, -46.63181545], 100);
  mapInstance = L.map('map').setView([-23.55029, -46.63397], 5.5);
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 18
  }).addTo(mapInstance);
  
  // Inicializa os grupos de marcadores vazios
  markerLayers = {
    'ROUBO': L.layerGroup().addTo(mapInstance),
    'FURTO': L.layerGroup().addTo(mapInstance),
    'ENCONTRADO': L.layerGroup().addTo(mapInstance),
    'OUTROS': L.layerGroup().addTo(mapInstance)
  };

  atualizarMapa();
}

function atualizarMapa() {
  if (!mapInstance || !dadosMapa) return;

  // Limpa os layers existentes
  Object.values(markerLayers).forEach(layer => layer.clearLayers());

  const showRoubo = document.getElementById('mapRoubo').checked;
  const showFurto = document.getElementById('mapFurto').checked;
  const showEncontrado = document.getElementById('mapEncontrado').checked;
  const showOutros = document.getElementById('mapOutros').checked;

  dadosMapa.forEach(ocorrencia => {
    if (!ocorrencia.LONGITUDE || !ocorrencia.LATITUDE) return;
    const latStr = ocorrencia.LATITUDE.replace(',', '.');
    const lonStr = ocorrencia.LONGITUDE.replace(',', '.');
    
    let tipo = 'OUTROS';
    let cor = '#00bbffff'; // Azul padrão para Outros/Não-classificado

    if (ocorrencia.RUBRICA?.toUpperCase().includes('ROUBO')) {
      tipo = 'ROUBO';
      cor = '#ff0000ff'; // Vermelho para Roubo
    } else if (ocorrencia.RUBRICA?.toUpperCase().includes('FURTO')) {
      tipo = 'FURTO';
      cor = '#ffa200ff'; // Laranja para Furto
    } else if (
      ocorrencia.RUBRICA?.toUpperCase().includes('ENCONTRADO') ||
      ocorrencia.RUBRICA?.toUpperCase().includes('RECUPERADO') ||
      ocorrencia.RUBRICA?.toUpperCase().includes('LOCALIZA')
    ) {
      tipo = 'ENCONTRADO';
      cor = '#00ff1eff'; // Verde para Encontrado/Recuperado
    }
    
    // Filtro de exibição
    if (
      (tipo === 'ROUBO' && !showRoubo) ||
        (tipo === 'FURTO' && !showFurto) ||
      (tipo === 'ENCONTRADO' && !showEncontrado) ||
      (tipo === 'OUTROS' && !showOutros)
    ) {
      return;
    }

    const marker = L.circleMarker([parseFloat(latStr), parseFloat(lonStr)], {
      radius: 5,
      fillColor: cor,
      color: '#fff',
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.6
    });
    
    marker.bindPopup(`
      <strong>${ocorrencia.RUBRICA || 'Desconhecido'}</strong><br>
      <strong>Local:</strong> ${ocorrencia.BAIRRO || 'N/A'}, ${ocorrencia.NOME_MUNICIPIO || 'N/A'}<br>
      <strong>Veículo:</strong> ${ocorrencia.DESCR_MARCA_VEICULO || 'N/A'} (${ocorrencia.DESCR_TIPO_VEICULO || 'N/A'})<br>
      <strong>Cor:</strong> ${ocorrencia.DESC_COR_VEICULO || 'N/A'}<br>
      <strong>Data:</strong> ${ocorrencia.DATA_OCORRENCIA_BO || 'N/A'}<br>
      <strong>Latuutude:</strong> ${latStr || 'N/A'}<br>
      <strong>Longitude:</strong> ${lonStr || 'N/A'}
    `);
    
    // Adiciona ao layer correto
    markerLayers[tipo]?.addLayer(marker);
  });
}

function aplicarFiltros() {
  // Por enquanto, apenas loga. A lógica de filtragem de gráficos é mais complexa e
  // exigiria a re-agregação dos dados. Como o usuário não enviou o código de
  // re-agregação, vamos focar no mapa e no layout.
  console.log('Filtros de seleção alterados. Para re-filtrar gráficos, a lógica de re-agregação precisa ser implementada.');
}

function criarGraficoDiaSemana() {
  const ctx = document.getElementById('weekdayChart')?.getContext('2d');
  if (!ctx) return;
  
  const diasOrdem = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 
                     'quinta-feira', 'sexta-feira', 'sábado'];
  const valores = diasOrdem.map(d => dadosEstatisticas.porDiaSemana[d] || 0);
  
  charts.weekday = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: diasOrdem.map(d => d.charAt(0).toUpperCase() + d.slice(1)),
      datasets: [{
        label: 'Ocorrências',
        data: valores,
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderColor: '#22c55e',
        borderWidth: 3,
        pointBackgroundColor: '#22c55e'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        r: { beginAtZero: true, grid: { color: '#334155' } }
      }
    }
  });
}
// Grafico por tipo de veiculo agrupado separados no tooltip (hover)
function criarGraficoTipoVeiculo() {
  const ctx = document.getElementById('tipoVeiculoChart')?.getContext('2d');
  if (!ctx) return;
  
    const dadosPorTipoVeiculo = dadosEstatisticas.porTipoVeiculo;

    // 1. DEFINIÇÃO DO AGRUPAMENTO
    const mapaAgrupamento = {
        'MOTOS/DUAS RODAS': ['MOTOCICLO', 'MOTONETA', 'CICLOMOTO', 'SIDE-CAR', 'TRICICLO'],
        'AUTOMÓVEIS/UTILITÁRIOS': ['AUTOMOVEL', 'CAMIONETA', 'CAMINHONETE', 'UTILITÁRIO', 'MOTOR CASA'],
        'CAMINHÕES/CARGAS': ['CAMINHÃO', 'CAMINHÃO TRATOR', 'CHASSI-PLATAFORMA'],
        'TRANSPORTE COLETIVO': ['ONIBUS', 'MICRO-ONIBUS'],
        'REBOQUES/IMPLEMENTOS': ['REBOQUE', 'SEMI-REBOQUE'],
        'VEÍCULOS RURAIS/ESPECIAIS': ['TRATOR ESTEIRAS', 'TRATOR MISTO', 'TRATOR RODAS', 'QUADRICICLO'],
        'NÃO MOTORIZADOS/ANTIGOS': ['BICICLETA', 'CARROÇA', 'CHARRETE', 'BONDE', 'CARRO DE MÃO'],
        'NÃO CLASSIFICADOS': ['DESCONHECIDO', 'INEXIST.', 'INEXISTENTE', 'NÃO INFORMADO']
    };

    const dadosAgrupados = {};

    // Inicializa a estrutura para armazenar o TOTAL e os DETALHES
    Object.keys(mapaAgrupamento).forEach(novaCategoria => {
        dadosAgrupados[novaCategoria] = {
            total: 0,
            detalhes: {} // Aqui vamos armazenar as subcategorias e contagens
        };
    });

    // 2. AGRUPAMENTO COM DETALHES
    Object.entries(dadosPorTipoVeiculo).forEach(([tipo, contagem]) => {
        for (const [novaCategoria, tiposOriginais] of Object.entries(mapaAgrupamento)) {
            if (tiposOriginais.includes(tipo)) {
                // Soma o total
                dadosAgrupados[novaCategoria].total += contagem;
                // Adiciona o detalhe
                dadosAgrupados[novaCategoria].detalhes[tipo] = contagem;
                return;
            }
        }
    });

    // 3. PREPARAÇÃO FINAL PARA O CHART.JS
    // O array 'tipos' agora carrega a chave e o objeto com total/detalhes
    const tipos = Object.entries(dadosAgrupados)
        .sort((a, b) => b[1].total - a[1].total);

    // 4. CRIAÇÃO DO GRÁFICO (O 'data' usa apenas o total)
  charts.tipoVeiculo = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: tipos.map(([k]) => k),
      datasets: [{
                // A 'data' é o array de totais (ex: [395672, 754904, ...])
                data: tipos.map(([, v]) => v.total), 
                backgroundColor: [
                    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
                    '#8b5cf6', '#06b6d4', '#6366f1', '#a8a29e'
                ],
        borderWidth: 2,
        borderColor: '#1e293b'
      }]
    },
    options: {
      responsive: true,
            plugins: { 
                legend: { position: 'right', labels: { color: '#94a3b8' } },
                
                // 5. CONFIGURAÇÃO AVANÇADA DO TOOLTIP
                tooltip: {
                    callbacks: {
                        // Título do Tooltip (Nome do Agrupamento e Total)
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const nomeCategoria = tipos[index][0];
                            const totalFormatado = tipos[index][1].total.toLocaleString('pt-BR');
                            
                            // Exemplo: MOTOS/DUAS RODAS (Total: 395.672)
                            return `${nomeCategoria} (Total: ${totalFormatado})`;
                        },
                        
                        // Corpo do Tooltip (Detalhes das Subcategorias)
                        label: function(context) {
                            // Este callback é chamado para cada item da legenda (em doughnut é apenas 1)
                            const index = context.dataIndex;
                            const detalhes = tipos[index][1].detalhes;
                            
                            const linhasDetalhe = [];
                            
                            // Itera sobre os detalhes (MOTOCICLO, MOTONETA, etc.)
                            Object.entries(detalhes)
                                .sort((a, b) => b[1] - a[1]) // Opcional: ordena os detalhes do maior para o menor
                                .forEach(([tipo, contagem]) => {
                                    const valorFormatado = contagem.toLocaleString('pt-BR');
                                    linhasDetalhe.push(`${tipo}: ${valorFormatado}`);
                                });
                            
                            // Retorna o array de strings, cada uma será uma linha no tooltip
                            return linhasDetalhe;
                        }
                    }
                }
            }
    }
  });
}
/** Mapeia cores dos veiculos
 * Mapeia o nome da cor do veículo para um código de cor RGBA (com 0.7 de opacidade).
 */
const mapearCorVeiculo = (nomeCor) => {
    const cor = nomeCor.toUpperCase().trim();

    // Mapeamento que cobre todas as suas cores
    switch (cor) {
        case 'PRETA':
            return 'rgba(0, 0, 0, 0.7)';
        case 'BRANCO':
        case 'BRANCA': // Cobrindo variações de gênero (mesmo que só tenha 'BRANCO')
            //return 'rgba(255, 255, 255, 0.7)';
            return 'rgba(242, 240, 239, 0.7)';
        case 'PRATA':
        case 'CINZA':
            return 'rgba(150, 150, 150, 0.7)';
        case 'VERMELHO':
        case 'VERMELHA':
        case 'GRENA': // Grena é um tom de vermelho/vinho
            return 'rgba(220, 20, 60, 0.7)'; // Crimson
        case 'AZUL':
            return 'rgba(59, 130, 246, 0.7)';
        case 'VERDE':
            return 'rgba(16, 185, 129, 0.7)';
        case 'AMARELO':
            return 'rgba(255, 255, 0, 0.7)';
        case 'LARANJA':
            return 'rgba(245, 158, 11, 0.7)';
        case 'MARROM':
        case 'BEGE':
            return 'rgba(139, 69, 19, 0.7)';
        case 'ROXA':
        case 'ROXO':
        case 'ROSA': // Rosa como um tom mais claro de roxo/magenta
            return 'rgba(192, 38, 211, 0.7)'; // Magenta/Roxo
        case 'DOURADA':
            return 'rgba(255, 215, 0, 0.7)'; // Gold
        case 'FANTASIA':
        case 'NÃO INFORMADO':
        case 'DESCONHECIDO':
        default:
            // Cores de fallback para dados incompletos ou cores multi-tom
            return 'rgba(168, 168, 168, 0.7)'; // Cinza neutro
    }
};

/** Mapeia cores de cada borda
 * Mapeia o nome da cor do veículo para um código de cor HEX para a borda.
 */
const mapearCorBorda = (nomeCor) => {
    const cor = nomeCor.toUpperCase().trim();
    switch (cor) {
        case 'PRETA': return '#000000';
        case 'BRANCO':
        case 'BRANCA': return '#000000ff'; // Cor clara para borda de fundo escuro
        case 'PRATA':
        case 'CINZA': return '#969696';
        case 'VERMELHO':
        case 'VERMELHA':
        case 'GRENA': return '#dc143c'; // Crimson
        case 'AZUL': return '#3b82f6';
        case 'VERDE': return '#10b981';
        case 'AMARELO': return '#FFFF00';
        case 'LARANJA': return '#f59e0b';
        case 'MARROM':
        case 'BEGE': return '#8b4513';
        case 'ROXA':
        case 'ROXO':
        case 'ROSA': return '#c026d3'; // Magenta
        case 'DOURADA': return '#FFD700';
        case 'FANTASIA':
        case 'NÃO INFORMADO':
        case 'DESCONHECIDO':
        default: return '#555555';
    }
};
// Cria grafico de cores dos veiculos, com as cores e as bordas mapeadas
function criarGraficoCores() {
    const ctx = document.getElementById('corChart')?.getContext('2d');
    if (!ctx) return;

    const cores = Object.entries(dadosEstatisticas.porCorVeiculo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const nomesDasCores = cores.map(([k]) => k);

    // Usa as novas funções de mapeamento:
    const backgroundColors = nomesDasCores.map(mapearCorVeiculo);
    const borderColors = nomesDasCores.map(mapearCorBorda);
    
    // Destrói o gráfico existente antes de criar um novo (se aplicável)
    if (charts.cores) {
        charts.cores.destroy();
    }

    charts.cores = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: nomesDasCores,
            datasets: [{
                label: 'Ocorrências',
                data: cores.map(([, v]) => v),
                backgroundColor: backgroundColors, 
                borderColor: borderColors, 
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { 
                legend: { position: 'right', labels: { color: '#94a3b8' } },
                tooltip: {
                    callbacks: {
                         label: function(context) {
                             const valor = context.parsed.r;
                             const total = context.dataset.data.reduce((a, b) => a + b, 0);
                             const percentual = ((valor / total) * 100).toFixed(1);
                             const valorFormatado = valor.toLocaleString('pt-BR');
                             return `Ocorrências: ${valorFormatado} (${percentual}%)`;
                         }
                    }
                }
            },
            scales: { r: { grid: { color: '#334155' } } }
        }
    });
}

function criarGraficoMunicipios() {
  const ctx = document.getElementById('regionChart')?.getContext('2d');
  if (!ctx) return;
  
  const municipios = Object.entries(dadosEstatisticas.porMunicipio)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  charts.municipios = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: municipios.map(([k]) => k),
      datasets: [{
        label: 'Ocorrências',
        data: municipios.map(([, v]) => v),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: '#3b82f6',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } },
      scales: { r: { grid: { color: '#334155' } } }
    }
  });
}

document.addEventListener('DOMContentLoaded', carregarDados);