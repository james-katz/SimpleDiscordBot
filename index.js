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
    if(commandName === 'startquiz') {                
        await interaction.deferReply();
        console.log('Um quiz foi iniciado por ' + interaction.user.username + '.');        
        
        const guildId = interaction.guild.id;
        console.log(guildId);
        // Hotfix for now, deal with it later xD
        if(guildId != '978714252934258779' && guildId != '1022920863303090206' && guildId != '554694662431178782') {
            interaction.editReply({embeds: [{
                color: 0xff0000,
                title: '🚫 Bot disabled on this server!',
                description: 'This bot is opensource, but the virtual cloud computing it runs on is paid.\nIf you want this bot in your discord server, please host it by your own means or contact the administrator for a special offer.'
            }]});
            return;
        }

        let lang = interaction.options.getString('language');

        let validLang = lang == 'pt' || lang == 'en' || lang == 'es';
        if(!validLang) {
           await axios.get(SERVER_DB+'/guildlang/'+guildId)
            .then((res) => {
                lang = res.data;
            });        
        }
        
        axios.get(SERVER_DB+'/getrand/' + guildId +'/' + lang)
        .then(res => {
            let question= res.data[0];
            let trivia = new Trivia(interaction, question, lang);
            setTimeout(() => {
                trivia.startTrivia();            
            }, 100);
        })
        .catch(err => {
            interaction.editReply({content:'Unable to connect to the database server ☹️\nPlease contact the administrator and inform the code: ' + err.code});
            console.log(err);
        });
    }
    else if(commandName === 'singlequiz') {        
        const quizModal = new ModalBuilder()
            .setCustomId('quizmodal')
            .setTitle('ZecQuiz');

        const questionInput = new TextInputBuilder()
            .setCustomId('question')
            .setLabel('Enunciado / Pergunta')            
            .setStyle(TextInputStyle.Paragraph);

        const answerAInput = new TextInputBuilder()
            .setCustomId('answer_0')
            .setLabel('Resposta correta')
            .setMaxLength(80)
            .setStyle(TextInputStyle.Short);

        const answerBInput = new TextInputBuilder()
            .setCustomId('answer_1')
            .setLabel('Resposta incorreta')
            .setMaxLength(80)
            .setStyle(TextInputStyle.Short);
        
        const answerCInput = new TextInputBuilder()
            .setCustomId('answer_2')
            .setLabel('Resposta incorreta')
            .setMaxLength(80)
            .setRequired(false)
            .setStyle(TextInputStyle.Short);

        const answerDInput = new TextInputBuilder()
            .setCustomId('answer_3')
            .setLabel('Resposta incorreta')
            .setMaxLength(80)
            .setRequired(false)
            .setStyle(TextInputStyle.Short);

        const questionInputRow = new ActionRowBuilder().addComponents(questionInput);
        const answerAInputRow = new ActionRowBuilder().addComponents(answerAInput);
        const answerBInputRow = new ActionRowBuilder().addComponents(answerBInput);
        const answerCInputRow = new ActionRowBuilder().addComponents(answerCInput);
        const answerDInputRow = new ActionRowBuilder().addComponents(answerDInput);

        quizModal.addComponents(questionInputRow, answerAInputRow, answerBInputRow, answerCInputRow, answerDInputRow);

        await interaction.showModal(quizModal);

        const filter = (interaction) => interaction.customId === 'quizmodal';
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

            let trivia = new Trivia(modalInteraction, question, 'pt');
            setTimeout(() => {
                trivia.startTrivia();    
            }, 1000);            
        })
    }
    else if(commandName === 'manage') {        
        //interaction.reply({content: 'To manage the quiz questions, access the link: http:///3.145.101.81/login/'+ interaction.guild.id +'\nWARNING: Do NOT share this links with anyone!', ephemeral: true});
        interaction.reply({content: 'Disabled', ephemeral: true});
    }

});

client.login(process.env.DISCORD_TOKEN);
