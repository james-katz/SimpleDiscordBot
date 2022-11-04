const { Client, GatewayIntentBits, ModalSubmitInteraction } = require('discord.js');
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const dotenv = require('dotenv');
const axios = require('axios');
const Trivia = require('./trivia');

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
    if(commandName === 'startquiz' || commandName === 'startquiz-en') {                
        await interaction.deferReply();
        console.log('Um quiz foi iniciado por ' + interaction.user.username + '.');        
        
        let lang = 'pt';
        if(commandName === 'startquiz-en') lang = 'en';
        let question = [];

        axios.get('http://3.145.101.81:3000/getrand/' + lang)
        .then(res => {
            Object.assign(question, res.data);
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
            .setLabel('Resposta correta         ')
            .setStyle(TextInputStyle.Short);

        const answerBInput = new TextInputBuilder()
            .setCustomId('answer_1')
            .setLabel('Resposta incorreta')
            .setStyle(TextInputStyle.Short);
        
        const answerCInput = new TextInputBuilder()
            .setCustomId('answer_2')
            .setLabel('Resposta incorreta')
            .setRequired(false)
            .setStyle(TextInputStyle.Short);

        const answerDInput = new TextInputBuilder()
            .setCustomId('answer_3')
            .setLabel('Resposta incorreta')
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
    else if(commandName === 'status') {        
        axios.get('http://3.145.101.81:3000/howmany')
        .then(res => {
            let registered = res.data;
            interaction.reply( {content:'Bot ativo em ' + interaction.guild.name + '!\nPerguntas cadastradas: ' + registered.questions + '.', ephemeral: true} );
        })
        .catch(err => {
            interaction.editReply({content:'Unable to connect to the database server ☹️\nPlease contact the administrator and inform the code: ' + err.code});
            console.log(err);
        });
    }

});

client.login(process.env.DISCORD_TOKEN);