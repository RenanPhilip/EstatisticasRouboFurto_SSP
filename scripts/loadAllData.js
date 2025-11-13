async function getFiles() {
  const date = new Date();
  const mesAtual = date.getMonth() + 1;
  const anoAtual = date.getFullYear();

  const quarterMap = { 
    1:1,2:1,3:1,
    4:2,5:2,6:2,
    7:3,8:3,9:3,
    10:4,11:4,12:4
  };
  const quarterAtual = quarterMap[mesAtual];

  const iniA = 2020, iniM = 1;
  const fimA = anoAtual, fimM = quarterAtual;
  const basePath = './data/';
  const files = [];

  // 🔹 Gera lista de arquivos por ano e trimestre
  for (let year = iniA; year <= fimA; year++) {
    const startQ = (year === iniA) ? iniM : 1;
    const endQ = (year === fimA) ? fimM : 4;
    for (let q = startQ; q <= endQ; q++) files.push(`${year}_Q${q}.json`);
  }

  // 🔹 Controla o número de downloads simultâneos
  async function limitedFetchAll(tasks, limit = 4) {
    const results = [];
    const executing = [];
    for (const task of tasks) {
      const p = task().then(r => results.push(r));
      executing.push(p);
      if (executing.length >= limit) await Promise.race(executing);
    }
    await Promise.all(executing);
    return results;
  }

  // 🔹 Faz o fetch e processamento de cada arquivo
  const results = await limitedFetchAll(
    files.map(file => async () => {
      const url = `${basePath}${file}`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Arquivo não encontrado');
        const data = await response.json();

        // 🧩 Converte e ordena os dados por data (DD/MM/YYYY)
        const processed = data.map(item => {
          const [dia, mes, ano] = item.DATA_OCORRENCIA_BO.split('/').map(Number);
          item._dataObj = new Date(ano, mes - 1, dia); // campo auxiliar
          return item;
        }).sort((a, b) => a._dataObj - b._dataObj);

        return { file, data: processed };
      } catch (err) {
        console.warn(`⚠️ Ignorado: ${file} (${err.message})`);
        return null;
      }
    }),
    4
  );

  // 🔹 Ordena os arquivos por ano/trimestre antes de unir
  const loadedData = results
    .filter(Boolean)
    .sort((a, b) => {
      const [yearA, qA] = a.file.match(/(\d{4})_Q(\d)/).slice(1).map(Number);
      const [yearB, qB] = b.file.match(/(\d{4})_Q(\d)/).slice(1).map(Number);
      return yearA - yearB || qA - qB;
    });

  console.log('📂 Arquivos carregados:', loadedData.map(f => f.file));
  return loadedData;
}

// 🔹 Executa automaticamente ao carregar o script
(async () => {
  console.time('⏱ Tempo de carregamento');
  
  const dados = await getFiles();
  
  // ✅ Junta todos os dados já ordenados e prontos para filtro
  window.todosDados = dados.flatMap(f => f.data);

  console.timeEnd('⏱ Tempo de carregamento');
  console.log('✅ Dados prontos em ordem:', todosDados.length);

  // ⚙️ Chama a função principal
  if (typeof carregarDados === 'function') carregarDados(todosDados);
})();
