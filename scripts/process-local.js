// scripts/process-local.js
// Processa dados históricos de CSVs já baixados (ordem DECRESCENTE para dados mais atualizados primeiro)
// Execute LOCALMENTE: node scripts/process-local.js

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Data atual (automático - sempre pega os dados mais recentes)
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const CSV_DIR = path.join(__dirname, 'temp', 'csv');

const COLUNAS_ALTERNATIVAS = {
  'NOME_MUNICIPIO': ['CIDADE', 'NOME_MUNICIPIO_CIRC'],
  'DATA_OCORRENCIA_BO': ['DATA_OCORRENCIA'],
  'HORA_OCORRENCIA': ['HORA_OCORRENCIA_BO'],
  'NOME_DELEGACIA': ['NOME_DELEGACIA_CIRC'],
  'DESC_COR_VEICULO': ['DESCR_COR_VEICULO']
};

function limparConteudo(conteudo) {
  let limpo = conteudo;
  if (limpo.charCodeAt(0) === 0xFEFF) {
    limpo = limpo.slice(1);
  }
  limpo = limpo.replace(/nullnullnull+/g, '');
  return limpo.trim();
}

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.toLowerCase() === 'null') {
    return null;
  }
  const match = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [_, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}`);
  return isNaN(date.getTime()) ? null : date;
}

function sanitizeValue(value) {
  if (value === null || value === undefined || value === '' || (typeof value === 'string' && value.toLowerCase() === 'null')) {
    return null;
  }
  return String(value).trim().replace(/"/g, '\\"').replace(/\n|\r/g, ' ') || null;
}

function getColumnValue(row, col) {
  if (row[col] !== undefined) return sanitizeValue(row[col]);
  const alternativas = COLUNAS_ALTERNATIVAS[col] || [];
  for (const alt of alternativas) {
    if (row[alt] !== undefined) return sanitizeValue(row[alt]);
  }
  return null;
}

function processarCSV(ano, mes, csvPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(csvPath)) {
      console.log(`      Arquivo não encontrado: ${csvPath}`);
      resolve({ ano, mes, registros: [] });
      return;
    }

    const anoMesTarget = `${ano}-${String(mes).padStart(2, '0')}`;
    const registros = [];

    try {
      const conteudo = fs.readFileSync(csvPath, 'utf8');
      const limpo = limparConteudo(conteudo);

      Papa.parse(limpo, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        transformHeader: h => h.trim(),
        dynamicTyping: false,
        step: (result) => {
          if (result.errors.length > 0) return;

          const row = result.data;
          const data = parseDate(getColumnValue(row, 'DATA_OCORRENCIA_BO'));
          
          if (!data) return;

          const anoData = data.getFullYear();
          const mesData = data.getMonth() + 1;
          const anoMesData = `${anoData}-${String(mesData).padStart(2, '0')}`;

          if (anoMesData !== anoMesTarget) return;

          const registro = {
            RUBRICA: getColumnValue(row, 'RUBRICA'),
            NOME_MUNICIPIO: getColumnValue(row, 'NOME_MUNICIPIO'),
            BAIRRO: getColumnValue(row, 'BAIRRO'),
            DESCR_MARCA_VEICULO: getColumnValue(row, 'DESCR_MARCA_VEICULO'),
            DESCR_TIPO_VEICULO: getColumnValue(row, 'DESCR_TIPO_VEICULO'),
            DESC_COR_VEICULO: getColumnValue(row, 'DESC_COR_VEICULO'),
            HORA_OCORRENCIA: getColumnValue(row, 'HORA_OCORRENCIA'),
            FLAG_FLAGRANTE: getColumnValue(row, 'FLAG_FLAGRANTE'),
            AUTORIA_BO: getColumnValue(row, 'AUTORIA_BO'),
            LATITUDE: getColumnValue(row, 'LATITUDE'),
            LONGITUDE: getColumnValue(row, 'LONGITUDE'),
            NOME_DELEGACIA: getColumnValue(row, 'NOME_DELEGACIA'),
            DATA_OCORRENCIA_BO: getColumnValue(row, 'DATA_OCORRENCIA_BO')
          };

          registros.push(registro);
        },
        complete: () => {
          resolve({ ano, mes, registros });
        },
        error: (err) => {
          console.error(`      Erro ao processar: ${err.message}`);
          resolve({ ano, mes, registros: [] });
        }
      });
    } catch (error) {
      console.error(`      Erro de leitura: ${error.message}`);
      resolve({ ano, mes, registros: [] });
    }
  });
}

async function main() {
  console.log('\n==========================================');
  console.log('  PROCESSAMENTO LOCAL - Dados Históricos');
  console.log('==========================================\n');
  console.log('Este script processa CSVs já em temp/csv/\n');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // ORDEM DECRESCENTE: 2025 até 2020 (dados mais recentes primeiro)
  const anos = [2025, 2024, 2023, 2022, 2021, 2020];
  
  for (const ano of anos) {
    console.log(`\n2025 → 2020 | ANO ${ano}:`);
    console.log('─'.repeat(40));
    
    const dadosTrimestrais = {
      1: [], // T1: Jan, Fev, Mar
      2: [], // T2: Abr, Mai, Jun
      3: [], // T3: Jul, Ago, Set
      4: []  // T4: Out, Nov, Dez
    };
    let totalRegistros = 0;

    // Processa cada mês de forma DECRESCENTE (12 até 1)
    for (let mes = 12; mes >= 1; mes--) {
      const trimestre = Math.ceil(mes / 3);
      const anoMesStr = `${ano}-${String(mes).padStart(2, '0')}`;
      const csvPath = path.join(CSV_DIR, `VeiculosSubtraidos_${ano}.csv`);
      
      process.stdout.write(`   ${anoMesStr} (T${trimestre}): `);
      
      const resultado = await processarCSV(ano, mes, csvPath);
      
      if (resultado.registros.length > 0) {
        console.log(`${resultado.registros.length} registros`);
        dadosTrimestrais[trimestre].push(...resultado.registros);
        totalRegistros += resultado.registros.length;
      } else {
        console.log('vazio');
      }
    }

    // Salva arquivos trimestrais
    for (const trimestre in dadosTrimestrais) {
      const dados = dadosTrimestrais[trimestre];
      if (dados.length > 0) {
        const filePath = path.join(DATA_DIR, `${ano}_T${trimestre}.json`);
        fs.writeFileSync(filePath, JSON.stringify(dados, null, 2));
        
        const sizeBytes = JSON.stringify(dados).length;
        const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
        
        console.log(`\n   Salvo: ${path.basename(filePath)}`);
        console.log(`   Tamanho: ${sizeMB} MB | Registros: ${dados.length.toLocaleString('pt-BR')}`);
      }
    }
    
    if (totalRegistros > 0) {
      console.log(`\n   Total do ano ${ano}: ${totalRegistros.toLocaleString('pt-BR')} registros\n`);
    } else {
      console.log(`\n   Nenhum registro encontrado para o ano ${ano}.\n`);
    }
  }

  // Salva estado
  const state = {
    tipoProcessamento: 'LOCAL - Dados históricos',
    datasProcessadas: '2020 a 2025 (ordem decrescente)',
    dataProcessamento: new Date().toISOString(),
    usandoLFS: true,
    proximoPasso: 'git add data/*_T*.json && git commit -m "Dados históricos trimestrais" && git push'
  };

  fs.writeFileSync(path.join(DATA_DIR, 'processing-state.json'), JSON.stringify(state, null, 2));

  console.log('\n==========================================');
  console.log('           PRÓXIMOS PASSOS');
  console.log('==========================================\n');
  console.log('1. Fazer commit dos novos arquivos trimestrais:');
  console.log('   git add data/*_T*.json\n');
  
  console.log('2. Fazer commit:');
  console.log('   git commit -m "Dados históricos SSP (2020-2025) por trimestre"\n');
  
  console.log('3. Fazer push:');
  console.log('   git push\n');
  
  console.log('4. Execute o aggregate-stats.js para gerar as estatísticas iniciais.\n');
}

main().catch(err => {
  console.error('\nERRO FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});