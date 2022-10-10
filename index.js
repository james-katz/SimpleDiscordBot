const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
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

// var questions = JSON.parse(fs.readFileSync('questions.json', 'utf-8'));
// if(questions) console.log(questions.length + " questions loaded successfully!");

client.once('ready', () => {
    console.log("Ready!");    
});

client.on('interactionCreate', interaction => {
    const { commandName } = interaction;
    if(commandName === 'startquiz') {        
        interaction.deferReply();
        console.log('Um quiz foi iniciado por ' + interaction.user.username + '.');
        
        let question = [];
        axios.get('http://localhost:3000/getrand')
        .then(res => {
            Object.assign(question, res.data);            
        });

        let trivia = new Trivia(interaction, question);
        setTimeout(() => {
            trivia.startTrivia();            
        }, 500);
    }
    else if(commandName ==='status') {
        interaction.reply( {content:'Bot ativo em ' + interaction.guild.name + '!\nPerguntas cadastradas: ' + questions.length + '.', ephemeral: true} );
    }
});

client.login(process.env.DISCORD_TOKEN);