// scripts/test-local.js - TESTE LOCAL DO SISTEMA INCREMENTAL

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const MESES_NOME = {
  1: 'JANEIRO', 2: 'FEVEREIRO', 3: 'MARÇO', 4: 'ABRIL',
  5: 'MAIO', 6: 'JUNHO', 7: 'JULHO', 8: 'AGOSTO',
  9: 'SETEMBRO', 10: 'OUTUBRO', 11: 'NOVEMBRO', 12: 'DEZEMBRO'
};

const COLUNAS_USAR = [
  'RUBRICA', 'NOME_MUNICIPIO', 'BAIRRO', 'DESCR_PERIODO',
  'DATA_OCORRENCIA_BO', 'HORA_OCORRENCIA', 'DESCR_TIPO_VEICULO',
  'DESCR_MARCA_VEICULO', 'DESC_COR_VEICULO', 'ANO_FABRICACAO',
  'AUTORIA_BO', 'FLAG_FLAGRANTE', 'LATITUDE', 'LONGITUDE'
];

async function testarArquivoLocal() {
  console.log('🧪 Teste Local - Sistema Incremental Mês a Mês\n');

  // Coloque aqui o caminho do arquivo baixado
  const caminhoArquivo = path.resolve(__dirname, 'temp', 'VeiculosSubtraidos_2024.xlsx');

  try {
    console.log(`📂 Lendo arquivo: ${caminhoArquivo}`);
    
    if (!fs.existsSync(caminhoArquivo)) {
      console.error(`❌ Arquivo não encontrado!`);
      console.log('\n💡 INSTRUÇÕES:');
      console.log('1. Baixe um arquivo da SSP-SP');
      console.log('   URL: https://www.ssp.sp.gov.br/estatistica/dados-mensais');
      console.log('2. Coloque em: scripts/temp/VeiculosSubtraidos_2024.xlsx');
      console.log('3. Execute novamente: node test-local.js\n');
      return;
    }

    const workbook = XLSX.readFile(caminhoArquivo, {
      cellDates: true,
      cellNF: false,
      cellText: false,
      sheetStubs: false
    });

    console.log(`✅ Arquivo carregado com sucesso!`);
    console.log(`📄 Abas encontradas (${workbook.SheetNames.length}): ${workbook.SheetNames.join(', ')}\n`);

    // Simula o processamento incremental
    console.log('🔍 SIMULANDO PROCESSAMENTO INCREMENTAL:\n');

    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    let mesAnterior = mesAtual - 1;
    if (mesAnterior === 0) mesAnterior = 12;

    console.log(`📅 Data de Simulação: ${hoje.toLocaleDateString('pt-BR')}`);
    console.log(`🔄 Mês ATUAL: ${MESES_NOME[mesAtual]} (SEMPRE processa)`);
    console.log(`🔄 Mês ANTERIOR: ${MESES_NOME[mesAnterior]} (SEMPRE processa)`);
    console.log(`✅ Outros meses: Apenas se nunca processados\n`);

    // Simula estado existente
    const stateSimulado = {
      mesesProcessados: {
        '2024-01': { registros: 25000 },
        '2024-02': { registros: 24500 },
        '2024-03': { registros: 26000 },
        '2024-04': { registros: 25500 },
        '2024-05': { registros: 26500 },
        '2024-06': { registros: 25800 }
      }
    };

    console.log('📊 Estado simulado (meses já processados):');
    console.log(`   ${Object.keys(stateSimulado.mesesProcessados).join(', ')}\n`);

    let totalRegistros = 0;
    const estatisticasPorMes = [];
    const mesesProcessariam = [];

    // Testa cada mês em ordem decrescente
    for (let mes = 12; mes >= 1; mes--) {
      const nomeMes = MESES_NOME[mes];
      const mesAnoKey = `2024-${String(mes).padStart(2, '0')}`;

      // Verifica se precisa processar
      const ehMesAtual = mes === mesAtual;
      const ehMesAnterior = mes === mesAnterior;
      const jaProcessado = stateSimulado.mesesProcessados[mesAnoKey];

      let status = '';
      let processaria = false;

      if (ehMesAtual) {
        status = '🔄 Mês ATUAL - Sempre atualiza';
        processaria = true;
      } else if (ehMesAnterior) {
        status = '🔄 Mês ANTERIOR - Sempre atualiza';
        processaria = true;
      } else if (jaProcessado) {
        status = '✅ Já processado (IMUTÁVEL) - Pula';
        processaria = false;
      } else {
        status = '🆕 Nunca processado - Processa';
        processaria = true;
      }

      console.log(`   ${nomeMes}: ${status}`);

      // Verifica se a aba existe
      const abaEncontrada = workbook.SheetNames.find(nome => 
        nome.toUpperCase() === nomeMes.toUpperCase()
      );

      if (!abaEncontrada) {
        console.log(`      ⚠️ Aba não encontrada no arquivo\n`);
        continue;
      }

      if (processaria) {
        mesesProcessariam.push(nomeMes);
      }

      // Carrega dados da aba
      const sheet = workbook.Sheets[abaEncontrada];
      const dadosCompletos = XLSX.utils.sheet_to_json(sheet, {
        raw: false,
        defval: null
      });

      // Simula otimização: filtra colunas
      const dadosOtimizados = dadosCompletos.map(row => {
        const rowOtimizada = {};
        COLUNAS_USAR.forEach(col => {
          if (row.hasOwnProperty(col)) {
            rowOtimizada[col] = row[col];
          }
        });
        return rowOtimizada;
      });

      totalRegistros += dadosOtimizados.length;

      // Análise rápida
      const roubos = dadosOtimizados.filter(r => 
        String(r.RUBRICA || '').toUpperCase().includes('ROUBO')
      ).length;

      const furtos = dadosOtimizados.filter(r => 
        String(r.RUBRICA || '').toUpperCase().includes('FURTO')
      ).length;

      const comCoordenadas = dadosOtimizados.filter(r => 
        r.LATITUDE && r.LONGITUDE
      ).length;

      // Calcula economia de memória
      const tamanhoCompleto = JSON.stringify(dadosCompletos).length;
      const tamanhoOtimizado = JSON.stringify(dadosOtimizados).length;
      const economia = ((1 - tamanhoOtimizado / tamanhoCompleto) * 100).toFixed(1);

      estatisticasPorMes.push({
        mes: nomeMes,
        total: dadosOtimizados.length,
        roubos,
        furtos,
        comCoordenadas,
        percCoordenadas: ((comCoordenadas / dadosOtimizados.length) * 100).toFixed(1),
        economiaMem: economia
      });

      console.log(`      📊 ${dadosOtimizados.length.toLocaleString()} registros`);
      console.log(`      📈 Roubos: ${roubos} | Furtos: ${furtos}`);
      console.log(`      🗺️  Com GPS: ${comCoordenadas} (${estatisticasPorMes[estatisticasPorMes.length - 1].percCoordenadas}%)`);
      console.log(`      💾 Economia memória: ${economia}%\n`);
    }

    // Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA SIMULAÇÃO');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Meses que SERIAM processados: ${mesesProcessariam.length}`);
    console.log(`   ${mesesProcessariam.join(', ')}`);
    
    const mesesPulariam = 12 - mesesProcessariam.length;
    console.log(`\n⏭️  Meses que seriam PULADOS: ${mesesPulariam}`);
    console.log(`   (Economia de ${((mesesPulariam / 12) * 100).toFixed(0)}% do tempo)`);

    console.log(`\n📈 Estatísticas Gerais:`);
    console.log(`   Total de registros no arquivo: ${totalRegistros.toLocaleString()}`);
    console.log(`   Meses com dados: ${estatisticasPorMes.length}`);
    
    const totalRoubos = estatisticasPorMes.reduce((acc, m) => acc + m.roubos, 0);
    const totalFurtos = estatisticasPorMes.reduce((acc, m) => acc + m.furtos, 0);
    const totalComGPS = estatisticasPorMes.reduce((acc, m) => acc + m.comCoordenadas, 0);
    const mediaEconomia = (estatisticasPorMes.reduce((acc, m) => acc + parseFloat(m.economiaMem), 0) / estatisticasPorMes.length).toFixed(1);
    
    console.log(`   Total Roubos: ${totalRoubos.toLocaleString()}`);
    console.log(`   Total Furtos: ${totalFurtos.toLocaleString()}`);
    console.log(`   Com Coordenadas: ${totalComGPS.toLocaleString()} (${((totalComGPS / totalRegistros) * 100).toFixed(1)}%)`);
    console.log(`   Economia média memória: ${mediaEconomia}%`);

    // Testa uma amostra do mês mais recente
    if (estatisticasPorMes.length > 0) {
      const mesRecente = estatisticasPorMes.find(m => mesesProcessariam.includes(m.mes));
      
      if (mesRecente) {
        const abaRecente = workbook.SheetNames.find(nome => 
          nome.toUpperCase() === mesRecente.mes.toUpperCase()
        );
        const dadosRecentes = XLSX.utils.sheet_to_json(workbook.Sheets[abaRecente], {
          raw: false,
          defval: null
        });

        console.log(`\n🔍 AMOSTRA DO MÊS QUE SERIA PROCESSADO (${mesRecente.mes}):`);
        
        // Filtra apenas colunas que usamos
        const amostraOtimizada = {};
        COLUNAS_USAR.forEach(col => {
          if (dadosRecentes[0].hasOwnProperty(col)) {
            amostraOtimizada[col] = dadosRecentes[0][col];
          }
        });
        
        console.log(JSON.stringify(amostraOtimizada, null, 2));

        // Valida colunas essenciais
        console.log('\n✅ VALIDAÇÃO DE COLUNAS NECESSÁRIAS:');
        const registro = dadosRecentes[0];
        COLUNAS_USAR.forEach(col => {
          if (registro.hasOwnProperty(col)) {
            const valor = registro[col];
            const preview = valor ? String(valor).substring(0, 30) : 'null';
            console.log(`   ✅ ${col}: "${preview}${String(valor).length > 30 ? '...' : ''}"`);
          } else {
            console.log(`   ❌ ${col}: FALTANDO!`);
          }
        });
      }
    }

    // Simula o estado que seria salvo
    console.log('\n💾 ESTADO QUE SERIA SALVO (processing-state.json):');
    const novoEstado = { ...stateSimulado };
    
    mesesProcessariam.forEach(nomeMes => {
      const mes = Object.keys(MESES_NOME).find(k => MESES_NOME[k] === nomeMes);
      const mesAnoKey = `2024-${String(mes).padStart(2, '0')}`;
      const stats = estatisticasPorMes.find(e => e.mes === nomeMes);
      
      novoEstado.mesesProcessados[mesAnoKey] = {
        hash: `${stats.total}-12345`,
        registros: stats.total,
        dataProcessamento: new Date().toISOString()
      };
    });
    
    console.log(JSON.stringify(novoEstado, null, 2));

    // Estimativa de tempo
    console.log('\n⏱️  ESTIMATIVA DE TEMPO:');
    const tempoDownload = 2; // minutos
    const tempoPorMes = 0.8; // minutos
    const tempoTotal = tempoDownload + (mesesProcessariam.length * tempoPorMes);
    
    console.log(`   Download do arquivo: ~${tempoDownload} min`);
    console.log(`   Processamento de ${mesesProcessariam.length} meses: ~${(mesesProcessariam.length * tempoPorMes).toFixed(1)} min`);
    console.log(`   TOTAL ESTIMADO: ~${tempoTotal.toFixed(1)} minutos`);

    // Comparação com abordagem antiga
    console.log('\n📊 COMPARAÇÃO COM ABORDAGEM ANTERIOR:');
    console.log(`   Abordagem Antiga:`);
    console.log(`   - Processaria TODOS os 12 meses`);
    console.log(`   - Tempo: ~${(tempoDownload + 12 * tempoPorMes).toFixed(1)} min`);
    console.log(`   - Memória: ~${(12 * 50).toFixed(0)} MB`);
    console.log(`\n   Abordagem Nova (Incremental):`);
    console.log(`   - Processa apenas ${mesesProcessariam.length} meses`);
    console.log(`   - Tempo: ~${tempoTotal.toFixed(1)} min`);
    console.log(`   - Memória: ~${(mesesProcessariam.length * 30).toFixed(0)} MB`);
    console.log(`   - ECONOMIA: ${((1 - tempoTotal / (tempoDownload + 12 * tempoPorMes)) * 100).toFixed(0)}% de tempo`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('1. Execute o script real: node update-data.js');
    console.log('2. Monitore os logs para confirmar comportamento');
    console.log('3. Verifique os arquivos gerados em ../data/');
    console.log('4. Faça commit e suba para o GitHub\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
  }
}

testarArquivoLocal();