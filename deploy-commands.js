const { REST, SlashCommandBuilder, Routes } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] })
	.then(() => console.log('Successfully deleted all global application commands.'))
	.catch(console.error);

rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [] })
	.then(() => console.log('Successfully deleted all guild application commands.'))
	.catch(console.error);

const commands = [
    new SlashCommandBuilder()
        .setName('startquiz')
        .setDescription('Inicia um quiz com perguntas sobre a Zcash e o mundo cripto.'),
	new SlashCommandBuilder()
        .setName('startquiz-en')
        .setDescription('Starts a trivia with questions about Zcash and the crypto world.'),
	new SlashCommandBuilder()
		.setName('status')
		.setDescription('Mostra informações sobre o bot.')
].map(command => command.toJSON());

rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
	.then((data) => console.log(`Successfully registered ${data.length} global application commands.`))
	.catch(console.error);