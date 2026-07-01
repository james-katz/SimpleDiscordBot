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
        .setName('jasperquiz')
        .setDescription('Starts a trivia with questions about crypto.')
		.addStringOption(option =>
			option.setName('prize')
				.setDescription('USD amount to be splitted between winners.')),

	new SlashCommandBuilder()
		.setName('singlequiz')
		.setDescription('Inicia um quiz que não está cadastrado no banco de dados.')
		.addStringOption(option =>
			option.setName('prize')
				.setDescription('USD amount to be splitted between winners.')),
	
	new SlashCommandBuilder()
		.setName('rank')
		.setDescription('Displays the trivia ranking.'),

	new SlashCommandBuilder()
		.setName('reset-ranking')
		.setDescription('Resets all trivia ranking scores.')
		.setDMPermission(false)
].map(command => command.toJSON());

rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
	.then((data) => console.log(`Successfully registered ${data.length} global application commands.`))
	.catch(console.error);
