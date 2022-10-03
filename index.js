const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const dotenv = require('dotenv');
const Trivia = require('./trivia');

dotenv.config();

const client = new Client({
     intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,    
    ],
 });


console.log("Booting...");

var questions = JSON.parse(fs.readFileSync('questions.json', 'utf-8'));
if(questions) console.log(questions.length + " questions loaded successfully!");

client.once('ready', () => {
    console.log("Ready!");    
});

client.on('interactionCreate', interaction => {
    const { commandName } = interaction;
    if(commandName === 'startquiz') {        
        interaction.deferReply();
        console.log('Um quiz foi iniciado por ' + interaction.user.username + '.');
        
        let trivia = new Trivia(interaction, questions);
        setTimeout(() => {
            trivia.startTrivia();            
        }, 500);
    }
    else if(commandName ==='status') {
        interaction.reply( {content:'Bot ativo em ' + interaction.guild.name + '!\nPerguntas cadastradas: ' + questions.length + '.\nUtilize ``/manage`` para gerenciar as perguntas cadastradas.', ephemeral: true} );
    }
});

client.login(process.env.DISCORD_TOKEN);