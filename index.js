const { Client, GatewayIntentBits, ModalSubmitInteraction } = require('discord.js');
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const dotenv = require('dotenv');
const axios = require('axios');
const Trivia = require('./trivia');

const SERVER_DB = 'http://localhost:3000' ;

dotenv.config();

const client = new Client({
     intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,    
    ],
 });

console.log("Booting...");

client.once('ready', () => {
    console.log("Ready!");    
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    if(commandName === 'jasperquiz') {    
        await interaction.deferReply();

        if(interaction.user.id !== '290336959627395072') {
            interaction.editReply({embeds: [{
                color: 0xff0000,
                title: '🚫 Sem permissão!',
                description: `Apenas o grande <@1122272347827732686> podo usar esse comando.`
            }]});
            return;
        }
        
        let prize = "";
        prize = interaction.options.getString('prize');
        if(prize) prize = prize.replace(/,/g, '.');

        if(prize >= 5) {
            interaction.editReply({embeds: [{
                color: 0xff0000,
                title: '🚫 Tip amount too high!',
                description: 'Right now I can only send ammounts less than $5 USD.'
            }]});
            return;
        }

        else if(!prize) {
            interaction.editReply({embeds: [{
                color: 0xff0000,
                title: '🚫 This command requires a prize amnount!',
                description: 'Please inform a tip amount less than $5 USD.'
            }]});
            return;
        }

        console.log('Um quiz foi iniciado por ' + interaction.user.username + '.');        
        
        const guildId = interaction.guild.id;
        // console.log(guildId);
        // Hotfix for now, deal with it later xD
        // if(guildId != '978714252934258779' && guildId != '1022920863303090206' && guildId != '554694662431178782') {
        //     interaction.editReply({embeds: [{
        //         color: 0xff0000,
        //         title: '🚫 Bot disabled on this server!',
        //         description: 'This bot is opensource, but the virtual cloud computing it runs on is paid.\nIf you want this bot in your discord server, please host it by your own means or contact the administrator for a special offer.'
        //     }]});
        //     return;
        // }

        let lang = interaction.options.getString('language');

        let validLang = lang == 'pt' || lang == 'en' || lang == 'es';
        if(!validLang) {
           await axios.get(SERVER_DB+'/guildlang/'+guildId)
            .then((res) => {
                lang = res.data;
            });        
        }
        lang = 'pt';
        let questionIdx = 0;
        
        axios.get(SERVER_DB+'/getseq/978714252934258779')
        .then(res => {
            if(res.data.error) {
                console.log('no question received')
                interaction.editReply({content:'Acabaram-se as perguntas'});

                return;
            }
            console.log(`Starting question ${questionIdx}\n\n`);
            let question = res.data[questionIdx];            
            let trivia = new Trivia(interaction, question, lang, prize);
            trivia.startTrivia(questionIdx);
            // await axios.delete(SERVER_DB+'/delete/' + question.id);
            questionIdx ++;
            
            let timer = setInterval(async () => {
                console.log(`Starting question ${questionIdx}\n\n`);
                
                setTimeout(async() => {
                    let question = res.data[questionIdx];  
                    
                    let trivia = new Trivia(interaction, question, lang, prize);    
                    trivia.startTrivia(questionIdx);
                    // await axios.delete(SERVER_DB+'/delete/' + question.id);
                    questionIdx ++;
                    if(questionIdx >= res.data.length) {
                        console.log("clearing timer")
                        clearInterval(timer);
                    }
                }, 100);                
            }, 60*1000);           
        })
        .catch(err => {
            interaction.editReply({content:'Unable to connect to the database server ☹️\nPlease contact the administrator and inform the code: ' + err.code});
            console.log(err);
        });
    }
    else if(commandName === 'singlequiz') {        
        let prize = "";
        prize = interaction.options.getString('prize');
        if(prize) prize = prize.replace(/,/g, '.');

        const quizModal = new ModalBuilder()
            .setCustomId(`quizmodal_${interaction.id}`)
            .setTitle('ZecQuiz');

        const questionInput = new TextInputBuilder()
            .setCustomId('question')
            .setLabel('Enunciado / Pergunta')            
            .setStyle(TextInputStyle.Paragraph);

        const answerAInput = new TextInputBuilder()
            .setCustomId('answer_0')
            .setLabel('Resposta correta')
            // .setMaxLength(80)
            .setStyle(TextInputStyle.Short);

        const answerBInput = new TextInputBuilder()
            .setCustomId('answer_1')
            .setLabel('Resposta incorreta')
            // .setMaxLength(80)
            .setStyle(TextInputStyle.Short);
        
        const answerCInput = new TextInputBuilder()
            .setCustomId('answer_2')
            .setLabel('Resposta incorreta')
            // .setMaxLength(80)
            .setRequired(false)
            .setStyle(TextInputStyle.Short);

        const answerDInput = new TextInputBuilder()
            .setCustomId('answer_3')
            .setLabel('Resposta incorreta')
            // .setMaxLength(80)
            .setRequired(false)
            .setStyle(TextInputStyle.Short);

        const questionInputRow = new ActionRowBuilder().addComponents(questionInput);
        const answerAInputRow = new ActionRowBuilder().addComponents(answerAInput);
        const answerBInputRow = new ActionRowBuilder().addComponents(answerBInput);
        const answerCInputRow = new ActionRowBuilder().addComponents(answerCInput);
        const answerDInputRow = new ActionRowBuilder().addComponents(answerDInput);

        quizModal.addComponents(questionInputRow, answerAInputRow, answerBInputRow, answerCInputRow, answerDInputRow);

        await interaction.showModal(quizModal).catch(err => console.log(err));

        const filter = (i) => i.customId === `quizmodal_${interaction.id}`;
        interaction.awaitModalSubmit({filter, time: 10 * 60 * 1000})
        .then(async modalInteraction => {
            await modalInteraction.deferReply();
            const question = {
                question: modalInteraction.fields.getTextInputValue('question'),
                answers: [
                    modalInteraction.fields.getTextInputValue('answer_0'),
                    modalInteraction.fields.getTextInputValue('answer_1'),
                    modalInteraction.fields.getTextInputValue('answer_2'),
                    modalInteraction.fields.getTextInputValue('answer_3'),
                ]
            }
            if(question.answers[2] === '' || question.answers[3] === '') {
                question.answers.splice(2,2);
            }            

            let trivia = new Trivia(modalInteraction, question, 'pt', prize);
            setTimeout(() => {
                trivia.startTrivia();    
            }, 1000);            
        }).catch((err) => console.log(err));
    }
    else if(commandName === 'manage') {        
        //interaction.reply({content: 'To manage the quiz questions, access the link: http:///3.145.101.81/login/'+ interaction.guild.id +'\nWARNING: Do NOT share this links with anyone!', ephemeral: true});
        interaction.reply({content: 'Disabled', ephemeral: true});
    }
});

client.login(process.env.DISCORD_TOKEN);
