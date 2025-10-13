// app.js - Dashboard Analytics Completo

let dadosEstatisticas = null;
let dadosMapa = null;
let mapInstance = null;
let charts = {};

// Configuração padrão dos gráficos
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';

// Carrega os dados ao iniciar
async function carregarDados() {
    try {
        // Carrega estatísticas principais
        const respEstatisticas = await fetch('data/estatisticas.json');
        if (!respEstatisticas.ok) throw new Error('Erro ao carregar estatísticas');
        dadosEstatisticas = await respEstatisticas.json();
        
        // Carrega dados do mapa
        const respMapa = await fetch('data/mapa-ocorrencias.json');
        if (respMapa.ok) {
            dadosMapa = await respMapa.json();
        }
        
        // Atualiza informação de última atualização
        const dataAtualizacao = new Date(dadosEstatisticas.ultimaAtualizacao);
        document.getElementById('updateInfo').innerHTML = `
            <strong>Última atualização:</strong> ${dataAtualizacao.toLocaleDateString('pt-BR')} às ${dataAtualizacao.toLocaleTimeString('pt-BR')}
            <br><strong>Total de registros:</strong> ${dadosEstatisticas.totalRegistros.toLocaleString('pt-BR')}
        `;
        
        // Popula filtros
        popularFiltros();
        
        // Exibe estatísticas
        atualizarCards();
        
        // Cria gráficos
        criarTodosGraficos();
        
        // Inicializa mapa
        if (dadosMapa && dadosMapa.length > 0) {
            inicializarMapa();
        }
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        document.querySelector('.container').insertAdjacentHTML('afterbegin', `
            <div class="error">
                ⚠️ Erro ao carregar dados. Verifique se os arquivos JSON foram gerados corretamente.
                <br><small>${error.message}</small>
            </div>
        `);
    }
}

function popularFiltros() {
    // Anos
    const anos = Object.keys(dadosEstatisticas.porAno).sort((a, b) => b - a);
    const yearFilter = document.getElementById('yearFilter');
    anos.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        yearFilter.appendChild(option);
    });
    
    // Municípios (top 20)
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
    
    // Rubricas
    const rubricas = Object.keys(dadosEstatisticas.porRubrica);
    const rubricaFilter = document.getElementById('rubricaFilter');
    rubricas.forEach(rubrica => {
        const option = document.createElement('option');
        option.value = rubrica;
        option.textContent = rubrica;
        rubricaFilter.appendChild(option);
    });
    
    // Períodos
    const periodos = Object.keys(dadosEstatisticas.porPeriodo);
    const periodoFilter = document.getElementById('periodoFilter');
    periodos.forEach(periodo => {
        const option = document.createElement('option');
        option.value = periodo;
        option.textContent = periodo;
        periodoFilter.appendChild(option);
    });
    
    // Event listeners
    document.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', aplicarFiltros);
    });
}

// NO SEU app.js
function atualizarCards() {
    // Calcula o Total Geral somando Roubos e Furtos
    const totalGeral = dadosEstatisticas.porRubrica['ROUBO DE VEÍCULO'] + dadosEstatisticas.porRubrica['FURTO DE VEÍCULO'] || 0 ;

    // 1. Atualiza o Total Geral (corresponde a 'totalGeral' no HTML)
    let totalGeralEL = totalGeral || 0 ;
    document.getElementById('totalGeral').textContent = totalGeralEL.toLocaleString('pt-BR')
        

    // 2. Atualiza o Total de Roubos
    let totalRoubosEL = dadosEstatisticas.porRubrica['ROUBO DE VEÍCULO'] || 0 ;
    document.getElementById('totalRoubos').textContent = totalRoubosEL.toLocaleString('pt-BR');
    
    // 3. Atualiza o Total de Furtos
    let totalFurtosEL = dadosEstatisticas.porRubrica['FURTO DE VEÍCULO'] || 0 ;
    document.getElementById('totalFurtos').textContent = totalFurtosEL.toLocaleString('pt-BR');
    
    // 4. (Verificar se você ainda quer manter estes cards, se sim, o HTML precisa deles)
    // ATENÇÃO: Os próximos dois cards ('totalOcorrencias' e 'totalMunicipios') *não existem* no seu HTML atual.
    // Se você não for adicioná-los, DEVE apagá-los do app.js.

    /*
    document.getElementById('totalMunicipios').textContent = 
        Object.keys(dadosEstatisticas.porMunicipio).length;
    
    const percFlagrantes = ((dadosEstatisticas.porFlagrante.sim / 
        (dadosEstatisticas.porFlagrante.sim + dadosEstatisticas.porFlagrante.nao)) * 100).toFixed(1);
    document.getElementById('totalFlagrantes').textContent = `${percFlagrantes}%`;
    
    const percAutoria = ((dadosEstatisticas.porAutoria.conhecida / 
        (dadosEstatisticas.porAutoria.conhecida + dadosEstatisticas.porAutoria.desconhecida)) * 100).toFixed(1);
    document.getElementById('autoriaConhecida').textContent = `${percAutoria}%`;
    */
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
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    // Ordena por mês/ano
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
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function criarGraficoHoras() {
    const ctx = document.getElementById('hourChart').getContext('2d');
    
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
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function criarGraficoMarcas() {
    const ctx = document.getElementById('marcasChart').getContext('2d');
    
    const top10 = dadosEstatisticas.top10MarcasMaisRoubadas;
    
    charts.marcas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10.map(m => m.marca),
            datasets: [{
                label: 'Ocorrências',
                data: top10.map(m => m.count),
                backgroundColor: 'rgba(236, 72, 153, 0.7)',
                borderColor: '#ec4899',
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#334155' }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

function criarGraficoDiaSemana() {
    const ctx = document.getElementById('weekdayChart').getContext('2d');
    
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
                pointBackgroundColor: '#22c55e',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#22c55e'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    angleLines: { color: '#334155' },
                    pointLabels: { color: '#94a3b8' }
                }
            }
        }
    });
}

function criarGraficoTipoVeiculo() {
    const ctx = document.getElementById('tipoVeiculoChart').getContext('2d');
    
    const tipos = Object.entries(dadosEstatisticas.porTipoVeiculo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    charts.tipoVeiculo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: tipos.map(([k]) => k),
            datasets: [{
                data: tipos.map(([, v]) => v),
                backgroundColor: [
                    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
                    '#10b981', '#06b6d4', '#6366f1', '#84cc16'
                ],
                borderWidth: 2,
                borderColor: '#1e293b'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8', padding: 15 }
                }
            }
        }
    });
}

function criarGraficoCores() {
    const ctx = document.getElementById('corChart').getContext('2d');
    
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
                    'rgba(59, 130, 246, 0.7)',
                    'rgba(139, 92, 246, 0.7)',
                    'rgba(236, 72, 153, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(6, 182, 212, 0.7)',
                    'rgba(99, 102, 241, 0.7)',
                    'rgba(132, 204, 22, 0.7)',
                    'rgba(239, 68, 68, 0.7)',
                    'rgba(168, 85, 247, 0.7)'
                ],
                borderWidth: 2,
                borderColor: '#1e293b'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8', padding: 10 }
                }
            },
            scales: {
                r: {
                    grid: { color: '#334155' },
                    ticks: { display: false }
                }
            }
        }
    });
}

function criarGraficoMunicipios() {
    const ctx = document.getElementById('municipiosChart').getContext('2d');
    
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
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function criarGraficoPeriodo() {
    const ctx = document.getElementById('periodoChart').getContext('2d');
    
    const periodos = Object.entries(dadosEstatisticas.porPeriodo)
        .sort((a, b) => b[1] - a[1]);
    
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
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#334155' }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

function inicializarMapa() {
    // Centro aproximado de São Paulo
    mapInstance = L.map('map').setView([-23.5505, -46.6333], 10);
    
    // Tile layer com tema escuro
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 18
    }).addTo(mapInstance);
    
    // Adiciona marcadores
    const markerGroups = {
        'ROUBO': [],
        'FURTO': [],
        'OUTROS': []
    };
    
    dadosMapa.forEach(ocorrencia => {
        const tipo = ocorrencia.rubrica.includes('ROUBO') ? 'ROUBO' : 
                     ocorrencia.rubrica.includes('FURTO') ? 'FURTO' : 'OUTROS';
        
        const cor = tipo === 'ROUBO' ? '#ef4444' : 
                    tipo === 'FURTO' ? '#f59e0b' : '#3b82f6';
        
        const marker = L.circleMarker([ocorrencia.lat, ocorrencia.lng], {
            radius: 4,
            fillColor: cor,
            color: '#fff',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6
        });
        
        marker.bindPopup(`
            <strong>${ocorrencia.rubrica}</strong><br>
            <strong>Local:</strong> ${ocorrencia.bairro}, ${ocorrencia.municipio}<br>
            <strong>Veículo:</strong> ${ocorrencia.marca} (${ocorrencia.tipo})<br>
            <strong>Data:</strong> ${new Date(ocorrencia.data).toLocaleDateString('pt-BR')}
        `);
        
        markerGroups[tipo].push(marker);
    });
    
    // Adiciona camadas ao mapa
    const overlays = {};
    Object.entries(markerGroups).forEach(([tipo, markers]) => {
        const layer = L.layerGroup(markers);
        layer.addTo(mapInstance);
        overlays[tipo] = layer;
    });
    
    // Controle de camadas
    L.control.layers(null, overlays).addTo(mapInstance);
}

function aplicarFiltros() {
    console.log('Filtros aplicados');
    // Implementar lógica de filtragem se necessário
}

// Inicia o carregamento
document.addEventListener('DOMContentLoaded', carregarDados);