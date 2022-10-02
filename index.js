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
        console.log('Um quiz foi iniciado por ' + interaction.user.username + '.');
        const msg = {
            author: {id: interaction.user.id},
            channel: client.channels.cache.get(interaction.channelId)
        };
        interaction.deferReply();
        let trivia = new Trivia(msg, questions);
        setTimeout(() => {
            trivia.startTrivia();
            interaction.deleteReply();
        }, 500);
    }
});

client.login(process.env.DISCORD_TOKEN);