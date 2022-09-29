const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const dotenv = require('dotenv');
const Trivia = require('./trivia');

dotenv.config();

const client = new Client({
     intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,    
        GatewayIntentBits.GuildMembers,    
		GatewayIntentBits.MessageContent
    ],
 });


console.log("Booting...");

var questions = JSON.parse(fs.readFileSync('questions.json', 'utf-8'));
if(questions) console.log(questions.length + " questions loaded successfully!");

client.once('ready', () => {
    console.log("Ready!");    
});

client.on('messageCreate', msg => {
    if(!msg.author.bot) {
        if(msg.content.includes("@here") || msg.content.includes("@everyone")) return false;
        if(!msg.member.roles.cache.has(process.env.ROLE_ID)) return false;
        
        let start = false;
    
        let cmd = msg.content.toLowerCase().trim().split(" ");
        if(cmd[0].toLowerCase() == '!startquiz') start = true;
        
        if(start) {
            console.log('Um quiz foi iniciado.');
            let trivia = new Trivia(msg, questions, cmd);
            setTimeout(() => trivia.startTrivia(), 500);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

