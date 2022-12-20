// WARNING: This file will erease the database!
// Use it for the first time setup only!

const { Sequelize } = require('sequelize');
const sequelize = require('../sequelize');

sequelize.authenticate()
.then(()=>{
    console.log('Database up and running!');
    init_db();
})
.catch(err=> {
    console.log('Fatal: No connection to the database!');
    process.exit(1);
});


async function init_db() {
    await sequelize.sync({ force: true });
    const guild = sequelize.models.guild;

    const zcash = await guild.create({id: "978714252934258779", name: "Zcash Latam", language: 'pt'});
    const shapeshift = await guild.create({id: "554694662431178782", name: "Shepashift", language: 'en'});
    const carabela = await guild.create({id: "934624477898227754", name: "Carabela", language: 'en'});

    let questions = [
        {
            question: "Qual dos nomes abaixo é considerado um dos criadores da Zcash?",
            answers: ["Zooko Wilcox","Satoshi Nakamoto","Vitalik Buterin","Steve Jobs"],
            lang: "pt"
        },
        {
            question: "Qual o fornecimento máximo da criptomoeda Zcash?",
            answers: ["21 milhões","42 milhões","1 bilhão","Infinito"],
            lang: "pt"
        },
        {
            question: "A sigla *zk-snarks* significa *Zero Knowledge Succint Non-Interactive Argument of Knowledge*.",
            answers: ["Verdadeiro","Falso"],
            lang: "pt"
        },
        {
            question: "Qual é a tecnologia usada nas transações blindadas da Zcash?",
            answers: ["zk-snarks","C++","Stealth","Decoy"],
        lang: "pt"
        },
        {
            question: "As assinaturas em anel (ring signatures) escondem a informação de qual output foi gasto pelo remetente, fornecendo a privacidade. Elas estão presentes desde a primeira versão da Zcash.",
            answers: ["Falso","Verdadeiro"],
            lang: "pt"
        },
        {
            question: "Em 2014 os pesquisadores da universidade de Johns Hopkins se juntam ao time de criptógrafos do MIT e da Universidade de Tel Aviv. Em conjunto eles criaram a proposta de melhoria do bitcoin. Qual era o nome da proposta?",
            answers: ["Zerocash","Zcash","Bitcoin 2.0","Shieldcoin"],
            lang: "pt"
        },
        {
            question: "Qual foi  o nome da ultima atualizaçao feita pela zcash?",
            answers: ["NU5","UP 2.0","Halo","Tsox"],
            lang: "pt"
        },
        {
            question: "No ecosistema Zcash, qual nome da instituição responsável pelos bens públicos?",
            answers: ["Zcash Foundation","ZecHub","Zcash","Eletric Coin Co."],
            lang: "pt"
        },
        {
            question: "No Ecosistema Zcash, qual dessas instituições é a responsável pela preocupação sob os detentores da moeda ZEC?",
            answers: ["Todas as opções","Zcash Foundation","Eletric Coin Co.","Zcash Community Grants"],
            lang: "pt"
        },
        {
            question: "Qual nome do evento responsável pela criação da Zcash?",
            answers: ["Cerimônia","Zcon","ZKP Event","Zerocoin Conf."],
            lang: "pt"
        },
        {
            question: "De acordo com o mecanismo de consenso Proof of Work (Prova de Trabalho), qual o responsável por solucionar formas matemáticas (Hash) para a criação de novos blocos na blockchain?",
            answers: ["Mineradores","Full Nodes","Stakers","Desenvolvedores"],
            lang: "pt"
        },
        {
            question: "Em que ano a Zcash foi criada?",
            answers: ["2016","2015","2012","2013"],
            lang: "pt"
        },
        {
            question: "Em qual país está localizada a sede da Eletric Coin Co & Zcash Foundation?",
            answers: ["Estados Unidos","Inglaterra","Australia","Noruega"],
            lang: "pt"
        },
        {
            question: "Quantos minutos ou segundos um bloco ZEC é minerado?",
            answers: ["75 segundos","50 segundos","2 minutos","4 minutos"],
            lang: "pt"
        },
        {
            question: "Quantos MB cada bloco ZEC possui?",
            answers: ["2 MB","1 MB","7 MB","9 MB"],
            lang: "pt"
        },
        {
            question: "Quanto é a taxa de transação por ZEC?",
            answers: ["0.0001 ZEC","0.1 ZEC","0.04 ZEC","0.01 ZEC"],
            lang: "pt"
        },
        {
            question: "Onde ocorreu a última Zcon?",
            answers: ["Las Vegas","São Francisco","Paris","Los Angeles"],
            lang: "pt"
        },
        {
            question: "Entre esses temas citados abaixo, qual os planos futuros para Zcash?",
            answers: ["Migrar para Proof of Stake","Manter-se Proof of Work","Aumentar a recompensa dos mineradores","Realizar um Fork"],
            lang: "pt"
        },
        {
            question: "Zcash é um fork de qual dessas criptos?",
            answers: ["Bitcoin","Monero","Ethereum","Doge Coin"],
            lang: "pt"
        },
        {
            question: "Qual foi o método de segurança usado durante a criação da Zcash?",
            answers: ["Airgap","Antivírus","2FA","VPN"],
            lang: "pt"
        },
        {
            question: "Tres organizaçoes recebem a emissao de fundo de desenvolvimento Zcash que totaliza ____ das recompensas de mineração.",
            answers: ["20%","40%","10%","35%"],
            lang: "pt"
        },
        {
            question: "Qual o nome do equipamento utilizado para minerar Zcash hoje em dia?",
            answers: ["ASICs","Gforce 2a45","Raspberry Pi 4","Antrouter R3"],
            lang: "pt"
        },
        {
            question: "Durante o processo que chamamos de *Cerimônia*, um dos participantes não fazia parte dos 6 escolhidos, pois o mesmo usava um pseudônimo denonimado como _________,que até o ano de 2022 ninguém sabia quem era.",
            answers: ["John Dobertinn","Zghost","Michael Del Castilho","Sifu0x"],
            lang: "pt"
        },
        {
            question: "Qual é o nome do novo enbaixador Zcash E.U.A trazido pela Zcash Community Grants (ZCG)?",
            answers: ["Madison Parks","John Zorm","Tom Asta","Gordon Mohr"],
            lang: "pt"
        },
        {
            question: "Uma ativaçao foi implementada no algoritimo da Zcash para conceder recompensas para o fundo de desenvolvimento de 2020 à 2024. Qual foi o nome dado a essa ativaçao?",
            answers: ["Canopy","Equihash","Halo","SHA-256"],
            lang: "pt"
        },
        {
            question: "Qual projeto nft tem uma coleção em homenagem  a Zcash?",
            answers: ["Cypherpunk","Cryptopunks","Gnars","Genuine undead"],
            lang: "pt"
        },
        {
            question: "Qual o nome do diretor executivo da Zcash foundation?",
            answers: ["Jack Gaviman","Gavin Andresen","Amber Baldet ","Zooko Willcox"],
            lang: "pt"
        },
        {
            question: "Qual e o nome dado a ultima implementação alternativa  para os nodes da Zcash?",
            answers: ["Zebra","Halo","NU5","Zcashd"],
            lang: "pt"
        },
        {
            question: "A Zcash tem um hub oficial de memes, qual e o nome dele?",
            answers: ["zeme team","shield memes","z memes cash","memeZ"],
            lang: "pt"
        },
        {
            question: "Em que dia foi realizada a primeira community call da Zcash brazil?",
            answers: ["5/10","3/10","30/09","7/10"],
            lang: "pt"
        },
        {
            question: "A zk-snarks tem sido implementada de uma forma diferente em um novo sistema de blockchain para melhor interoperabilidade e escalabilidade, qual o nome desse sistema?",
            answers: ["zk-rollups"," zk-chains","zk-optimistik","zk-layers"],
            lang: "pt"
        },
        {
            question: "Segundo o Coin Market Cap a moeda ZEC esta listada em quantas corretoras?",
            answers: ["50","23","47","31"],
            lang: "pt"
        },
        {
            question: "A versão 3.0.0 da Zcashd trouxe a  atualização Heartwood, que permite a mineração a endereços protegidos de Sapling.\nNa altura de que bloco essa atualização ocorreu?",
            answers: ["Bloco 903.000","Bloco 308.000","Bloco 715.000","Bloco 1256.000"],
            lang: "pt"
        },
        {
            question: "Sabendo que a  Ycash e um fork da Zcash e custodia nossa Ywallet, em que data foi minerado o bloco gênesis deles segundo a Ycash foundation?",
            answers: ["19/7/2019","23/4/2018","08/2/2020","11/11/2011"],
            lang: "pt"
        },
        {
            question: "What is the maximum supply of Zcash coins?",
            answers: ["21 million","42 million","21 billion","Infinite"],
            lang: "en"
        },
        {
            question: "¿Cuál de los siguientes nombres se considera uno de los creadores de Zcash?",
            answers: ["Zooko Wilcox","Bernardo O'Higgins","Bill Gates","Vitalik Buterin"],
            lang: "es"
        }        
    ];

    insertQuestions(zcash, questions);

    // Shapeshift
    questions = [        
        {
            question: "Qual o fornecimento máximo de tokens Fox?",
            answers: ["1,000,001,337","21,000,000","1,337","Infinito"],
            lang: "pt"
        },
        {
            question: "What is the maximum supply of Fox tokens??",
            answers: ["1,000,001,337","21,000,000","1,337","Infinito"],
            lang: "en"
        },
        {
            question: "¿Cuál es el suministro máximo de tokens Fox?",
            answers: ["1,000,001,337","21,000,000","1,337","Infinito"],
            lang: "es"
        }
    ];
    insertQuestions(shapeshift, questions);
}

async function insertQuestions(guild, questions) {
    for(const q of questions) {
        await guild.createQuestion({
            question: q.question,
            answers: q.answers,
            language: q.lang
        });
    }
}