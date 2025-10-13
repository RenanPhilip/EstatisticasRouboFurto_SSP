// scripts/test-local.js - OTIMIZADO PARA VALIDAR COLUNAS E PERFORMANCE

const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

// Colunas essenciais que o update-data.js precisa para rodar
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

async function testarArquivoLocal() {
    console.log('🧪 Teste local de processamento de dados SSP-SP (Otimizado)\n');

    // AJUSTE AQUI: coloque o caminho do arquivo que você baixou
    // O __dirname garante que ele sempre começa na pasta 'scripts'
    const caminhoArquivo = path.resolve(__dirname, 'temp', 'Amostra_Limpa.xlsx');

    try {
        console.log(`📂⏱️ Lendo arquivo: ${caminhoArquivo}`);

        // 1. OTIMIZAÇÃO: Lê o arquivo de forma leve
        const workbook = XLSX.readFile(caminhoArquivo, { cellDates: true, raw: false });

        const primeiraAba = workbook.SheetNames[0];
        const sheet = workbook.Sheets[primeiraAba];

        // scripts/test-local.js

        // ...

        // 2. OTIMIZAÇÃO: Carrega como Array de Arrays (header: 1)
        console.log(`\n⏳ Carregando dados da aba "${primeiraAba}" como Array de Arrays (Limitando a A1:AZ10000)...`);

        // Adicione a opção 'range' para limitar a leitura a 10.000 linhas e 52 colunas (AZ)
        const dadosArray = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            defval: null,
            range: 'A1:AZ10000' // <--- NOVO LIMITE TEMPORÁRIO PARA TESTE!
        });

        if (dadosArray.length === 0) {
            console.log('   Total de linhas: 0. Teste falhou.');
            return;
        }

        const cabecalho = dadosArray[0];
        const linhasDados = dadosArray.slice(1);

        console.log(`   Total de linhas de dados: ${linhasDados.length.toLocaleString()}`);

        // 3. Valida se as colunas essenciais existem
        console.log('\n🔑 Validação das Colunas Essenciais:');
        const indicesEssenciais = {};
        let colunasFaltando = false;

        COLUNAS_ESSENCIAIS.forEach(colunaDesejada => {
            const indice = cabecalho.findIndex(nomeNaPlanilha =>
                String(nomeNaPlanilha || '').trim().toUpperCase() === colunaDesejada.toUpperCase()
            );

            if (indice !== -1) {
                console.log(`   ✅ Encontrada: "${colunaDesejada}" (Índice: ${indice})`);
                indicesEssenciais[colunaDesejada] = indice;
            } else {
                console.log(`   ❌ Faltando: "${colunaDesejada}"`);
                colunasFaltando = true;
            }
        });

        if (colunasFaltando) {
            console.error('\n❌ ERRO: O script update-data.js PODE FALHAR. Verifique os nomes das colunas e ajuste COLUNAS_ESSENCIAIS.');
        }

        // 4. Cria amostra otimizada para análise (Primeiras 100 linhas)
        const amostraOtimizada = linhasDados.slice(0, 100)
            .map(linha => {
                const obj = {};
                for (const [chave, indice] of Object.entries(indicesEssenciais)) {
                    obj[chave] = linha[indice];
                }
                return obj;
            });

        if (amostraOtimizada.length > 0) {
            console.log('\n📊 Exemplo de Dados Otimizados (Primeiro Registro):');
            console.log(JSON.stringify(amostraOtimizada[0], null, 2));

            // 5. Análise de Roubo/Furto/Recuperação (o novo termômetro)
            console.log('\n🎯 Análise de Subtração (Roubo/Furto) vs. Recuperação:');
            let rouboCount = 0;
            let furtoCount = 0;
            let recuperacaoCount = 0;

            amostraOtimizada.forEach(r => {
                const rubrica = String(r.RUBRICA || '').toUpperCase();
                const status = String(r.DESCR_OCORRENCIA_VEICULO || '').toUpperCase();

                if (rubrica.includes('ROUBO')) {
                    rouboCount++;
                } else if (rubrica.includes('FURTO')) {
                    furtoCount++;
                }

                // Testa a nova coluna para Recuperação
                if (status.includes('LOCALIZACAO') || status.includes('ENCONTRO') || status.includes('RECUPERACAO')) {
                    recuperacaoCount++;
                }
            });

            console.log(`   Total de Amostra: ${amostraOtimizada.length}`);
            console.log(`   Roubos (Amostra): ${rouboCount}`);
            console.log(`   Furtos (Amostra): ${furtoCount}`);
            console.log(`   Recuperações (Amostra): ${recuperacaoCount}`);
            console.log(`   Taxa Recup. (Amostra): ${(recuperacaoCount / amostraOtimizada.length * 100).toFixed(2)}%`);

            // 6. Teste de formato de Coordenadas e Hora
            const exemploMapa = amostraOtimizada.find(r => r.LATITUDE && r.LONGITUDE);
            if (exemploMapa) {
                const lat = parseFloat(exemploMapa.LATITUDE);
                const lng = parseFloat(exemploMapa.LONGITUDE);
                const hora = exemploMapa.HORA_OCORRENCIA ?
                    String(exemploMapa.HORA_OCORRENCIA).split(':')[0] : 'N/A';

                console.log('\n🗺️  Teste de Formato para Mapa e Hora:');
                console.log(`   Latitude: "${exemploMapa.LATITUDE}" -> ${!isNaN(lat) ? '✅ Válida' : '❌ Inválida'}`);
                console.log(`   Longitude: "${exemploMapa.LONGITUDE}" -> ${!isNaN(lng) ? '✅ Válida' : '❌ Inválida'}`);
                console.log(`   Hora (Exemplo): "${exemploMapa.HORA_OCORRENCIA}" -> Extrato: "${hora}"`);
            } else {
                console.log('\n⚠️ Nenhum registro na amostra tem LATITUDE/LONGITUDE válidas para teste.');
            }
        }

        console.log('\n✅ Teste concluído com sucesso!');

    } catch (error) {
        console.error('\n❌ Erro ao processar arquivo:', error.message);
        // ... (instruções de erro)
    }
}

testarArquivoLocal();