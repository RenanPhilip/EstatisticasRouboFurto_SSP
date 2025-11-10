let anosQuarter = [
  "2020_Q1.json","2020_Q2.json","2020_Q3.json","2020_Q4.json",
  "2021_Q1.json","2021_Q2.json","2021_Q3.json","2021_Q4.json",
  "2022_Q1.json","2022_Q2.json","2022_Q3.json","2022_Q4.json",
  "2023_Q1.json","2023_Q2.json","2023_Q3.json","2023_Q4.json",
  "2024_Q1.json","2024_Q2.json","2024_Q3.json","2024_Q4.json",
  "2025_Q1.json","2025_Q2.json","2025_Q3.json"
]
const fs = require('fs');
let pasta = './EstatisticasRouboFurto_SSP/data'
fs.readdir(pasta, (err, arquivos) => {
  if (err) {
    console.error('Erro ao ler a pasta:', err);
    return;
  }

  arquivos.forEach(arquivo => {
    console.log(arquivo)
  });
});