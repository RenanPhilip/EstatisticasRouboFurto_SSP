// app.js - Dashboard Analytics Completo com validação (versão 2.0)
let dadosEstatisticas = null;
let dadosMapa = null;
let mapInstance = null;
let charts = {};

Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';

// 🔹 Variáveis automáticas de tempo
const agora = new Date();
const mesAtual = agora.getMonth() + 1;
const anoAtual = agora.getFullYear();
const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
const anoMesAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual;

async function carregarDados() {
  try {
    console.log('Carregando dados...');

    // Carrega estatísticas iniciais (dados imutáveis)
    const respEstatisticas = await fetch('data/estatisticas.json');
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

    // Carrega mapa
    const respMapa = await fetch('data/mapa-ocorrencias.json');
    if (respMapa.ok) {
      const textoMapa = await respMapa.text();
      if (!textoMapa.includes('git-lfs')) {
        dadosMapa = JSON.parse(textoMapa);
      }
    }

    // Atualiza interface
    const dataAtualizacao = new Date(dadosEstatisticas.ultimaAtualizacao);
    document.getElementById('updateInfo').innerHTML = `
      <strong>Última atualização:</strong> ${dataAtualizacao.toLocaleDateString('pt-BR')} às ${dataAtualizacao.toLocaleTimeString('pt-BR')}
      <br><strong>Total de registros:</strong> ${dadosEstatisticas.totalRegistros.toLocaleString('pt-BR')}
    `;

    // Popula a interface imediatamente
    popularFiltros();
    atualizarCards();
    criarTodosGraficos();

    if (dadosMapa && dadosMapa.length > 0) {
      inicializarMapa();
    }

    // 🔹 Atualiza dados do mês atual e anterior em background
    atualizarMesesRecentes();

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

// 🔹 Atualização assíncrona dos meses recentes (não bloqueia o dashboard)
async function atualizarMesesRecentes() {
  try {
    console.log(`🔄 Atualizando dados de ${mesAnterior}/${anoMesAnterior} e ${mesAtual}/${anoAtual}...`);

    const urls = [
      `data/${anoMesAnterior}-${String(mesAnterior).padStart(2, '0')}.json`,
      `data/${anoAtual}-${String(mesAtual).padStart(2, '0')}.json`
    ];

    for (const url of urls) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          console.warn(`⚠️ Arquivo ${url} não encontrado`);
          continue;
        }

        const texto = await resp.text();
        if (texto.includes('git-lfs')) continue;

        const novosDados = JSON.parse(texto);
        if (novosDados && novosDados.totalRegistros) {
          // 🔹 Mescla dados novos com os antigos
          Object.keys(novosDados).forEach(chave => {
            if (typeof novosDados[chave] === 'object') {
              dadosEstatisticas[chave] = {
                ...dadosEstatisticas[chave],
                ...novosDados[chave]
              };
            } else {
              dadosEstatisticas[chave] = novosDados[chave];
            }
          });
          console.log(`✅ Dados de ${url} atualizados com sucesso.`);
        }
      } catch (e) {
        console.warn(`Erro ao processar ${url}:`, e);
      }
    }

    // Atualiza interface após atualização dos meses
    atualizarCards();
    criarTodosGraficos();
    console.log('✅ Atualização concluída.');

  } catch (error) {
    console.error('Erro ao atualizar meses recentes:', error);
  }
}

// 🔹 Funções originais mantidas
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

  document.querySelectorAll('select').forEach(select => {
    select.addEventListener('change', aplicarFiltros);
  });
}

function atualizarCards() {
  const totalGeral = (dadosEstatisticas.porRubrica['ROUBO DE VEÍCULO'] || 0) + 
                     (dadosEstatisticas.porRubrica['FURTO DE VEÍCULO'] || 0);
  
  document.getElementById('totalGeral').textContent = totalGeral.toLocaleString('pt-BR');
  document.getElementById('totalRoubos').textContent = (dadosEstatisticas.porRubrica['ROUBO DE VEÍCULO'] || 0).toLocaleString('pt-BR');
  document.getElementById('totalFurtos').textContent = (dadosEstatisticas.porRubrica['FURTO DE VEÍCULO'] || 0).toLocaleString('pt-BR');
  document.getElementById('totalMunicipios').textContent = Object.keys(dadosEstatisticas.porMunicipio).length;
  
  const totalFlagrantes = dadosEstatisticas.porFlagrante.sim + dadosEstatisticas.porFlagrante.nao;
  const percFlagrantes = totalFlagrantes > 0 ? ((dadosEstatisticas.porFlagrante.sim / totalFlagrantes) * 100).toFixed(1) : 0;
  document.getElementById('totalFlagrantes').textContent = `${percFlagrantes}%`;
  
  const totalAutoria = dadosEstatisticas.porAutoria.conhecida + dadosEstatisticas.porAutoria.desconhecida;
  const percAutoria = totalAutoria > 0 ? ((dadosEstatisticas.porAutoria.conhecida / totalAutoria) * 100).toFixed(1) : 0;
  document.getElementById('autoriaConhecida').textContent = `${percAutoria}%`;
}

function criarTodosGraficos() {
  criarGraficoTimeline();
  criarGraficoHoras();
  criarGraficoMarcas();
  criarGraficoDiaSemana();
  criarGraficoTipoVeiculo();
  criarGraficoCores();
  criarGraficoMunicipios();
  criarGraficoPeriodo();
}

function criarGraficoTimeline() {
  const ctx = document.getElementById('monthlyChart')?.getContext('2d');
  if (!ctx) return;
  
  const mesAnoOrdenado = Object.entries(dadosEstatisticas.porMesAno)
    .sort((a, b) => {
      const [mesA, anoA] = a[0].split('/');
      const [mesB, anoB] = b[0].split('/');
      return new Date(anoA, mesA - 1) - new Date(anoB, mesB - 1);
    });
  
  charts.timeline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: mesAnoOrdenado.map(([k]) => k),
      datasets: [{
        label: 'Ocorrências por Mês',
        data: mesAnoOrdenado.map(([, v]) => v),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#334155' } },
        x: { grid: { display: false } }
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

function inicializarMapa() {
  mapInstance = L.map('map').setView([-23.5505, -46.6333], 10);
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 18
  }).addTo(mapInstance);
  
  const markerGroups = {
    'ROUBO': [],
    'FURTO': [],
    'OUTROS': []
  };
  
  dadosMapa.forEach(ocorrencia => {
    if (!ocorrencia.LATITUDE || !ocorrencia.LONGITUDE) return;
    
    const tipo = ocorrencia.RUBRICA?.includes('ROUBO') ? 'ROUBO' : 
                 ocorrencia.RUBRICA?.includes('FURTO') ? 'FURTO' : 'OUTROS';
    
    const cor = tipo === 'ROUBO' ? '#ef4444' : 
                tipo === 'FURTO' ? '#f59e0b' : '#3b82f6';
    
    const marker = L.circleMarker([parseFloat(ocorrencia.LATITUDE), parseFloat(ocorrencia.LONGITUDE)], {
      radius: 4,
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
      <strong>Data:</strong> ${ocorrencia.DATA_OCORRENCIA_BO || 'N/A'}
    `);
    
    markerGroups[tipo].push(marker);
  });
  
  const overlays = {};
  Object.entries(markerGroups).forEach(([tipo, markers]) => {
    const layer = L.layerGroup(markers);
    layer.addTo(mapInstance);
    overlays[tipo] = layer;
  });
  
  L.control.layers(null, overlays).addTo(mapInstance);
}

function aplicarFiltros() {
  console.log('Filtros aplicados');
}

document.addEventListener('DOMContentLoaded', carregarDados);

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

function criarGraficoTipoVeiculo() {
  const ctx = document.getElementById('tipoVeiculoChart')?.getContext('2d');
  if (!ctx) return;
  
  const tipos = Object.entries(dadosEstatisticas.porTipoVeiculo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  
  charts.tipoVeiculo = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: tipos.map(([k]) => k),
      datasets: [{
        data: tipos.map(([, v]) => v),
        backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#84cc16'],
        borderWidth: 2,
        borderColor: '#1e293b'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
    }
  });
}

function criarGraficoCores() {
  const ctx = document.getElementById('corChart')?.getContext('2d');
  if (!ctx) return;
  
  const cores = Object.entries(dadosEstatisticas.porCorVeiculo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  charts.cores = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: cores.map(([k]) => k),
      datasets: [{
        data: cores.map(([, v]) => v),
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(236, 72, 153, 0.7)',
          'rgba(245, 158, 11, 0.7)', 'rgba(16, 185, 129, 0.7)', 'rgba(6, 182, 212, 0.7)',
          'rgba(99, 102, 241, 0.7)', 'rgba(132, 204, 22, 0.7)', 'rgba(239, 68, 68, 0.7)', 'rgba(168, 85, 247, 0.7)'
        ],
        borderWidth: 2,
        borderColor: '#1e293b'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } },
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
