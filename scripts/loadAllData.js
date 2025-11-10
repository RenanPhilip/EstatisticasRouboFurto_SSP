async function getFiles() {

  const date = new Date();
  const mesAtual = date.getMonth()
  const anoAtual = date.getFullYear()
  
  const quarterMap = { 
    1 : 1, 2 : 1, 3: 1,
    4 : 2, 5 : 2, 6: 2,
    7 : 3, 8 : 3, 9: 3,
    10: 4, 11: 4, 12: 4
  };
  const quarterAtual = quarterMap[mesAtual];
  
  iniA = 2020, 
  iniM = 1

  fimA = anoAtual
  fimM = quarterAtual

  const basePath = './data/';
  const files = [];

  // 🔹 Gera a lista de arquivos esperados
  if (iniA === fimA) {
    for (let q = iniM; q <= fimM; q++) files.push(`${iniA}_Q${q}.json`);
  } else {
    for (let year = iniA; year <= fimA; year++) {
      if (year === iniA) {
        for (let q = iniM; q <= 4; q++) files.push(`${year}_Q${q}.json`);
      } else if (year === fimA) {
        for (let q = 1; q <= fimM; q++) files.push(`${year}_Q${q}.json`);
      } else {
        for (let q = 1; q <= 4; q++) files.push(`${year}_Q${q}.json`);
      }
    }
  }

  // 🔥 Faz o carregamento em paralelo
  const fetchPromises = files.map(async (file) => {
    const url = `${basePath}${file}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Arquivo não encontrado');
      const data = await response.json();
      // console.log(`✅ Carregado: ${file}`);
      return { file, data };
    } catch (err) {
      console.warn(`⚠️ Ignorado: ${file} (${err.message})`);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);
  const loadedData = results.filter(Boolean);

  // 🔹 Ordena pelo nome do arquivo (ano e trimestre)
  loadedData.sort((a, b) => {
    const [yearA, quarterA] = a.file.match(/(\d{4})_Q(\d)/).slice(1).map(Number);
    const [yearB, quarterB] = b.file.match(/(\d{4})_Q(\d)/).slice(1).map(Number);
    if (yearA !== yearB) return yearA - yearB;
    return quarterA - quarterB;
  });

  console.log('📂 Arquivos carregados:', loadedData.map(f => f.file));
  return loadedData;
}

document.addEventListener('DOMContentLoaded', async () => {
  console.time('⏱ Tempo de carregamento');
  const dados = await getFiles();
  todosDados = dados.flatMap(f => f.data);
  console.timeEnd('⏱ Tempo de carregamento');
  console.log('✅ Dados prontos em ordem:', todosDados);
  carregarDados();
});
