const { Client, GatewayIntentBits } = require('discord.js');
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
    if(commandName === 'startquiz') {                
        await interaction.deferReply();
        console.log('Um quiz foi iniciado por ' + interaction.user.username + '.');        
        let question = [];
        axios.get('http://3.145.101.81:3000/getrand')
        .then(res => {
            Object.assign(question, res.data);
            let trivia = new Trivia(interaction, question);
            setTimeout(() => {
                trivia.startTrivia();            
            }, 100);
        });
    }
    else if(commandName ==='status') {
        await interaction.deferReply();
        axios.get('http://3.145.101.81:3000/howmany')
        .then(res => {
            let registered = res.data;
            interaction.editReply( {content:'Bot ativo em ' + interaction.guild.name + '!\nPerguntas cadastradas: ' + registered.questions + '.', ephemeral: true} );
        });        
    }

});

client.login(process.env.DISCORD_TOKEN);