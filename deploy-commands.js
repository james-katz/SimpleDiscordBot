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
        .setDescription('Starts a trivia with questions about crypto.')
		.setDescriptionLocalizations({
			'pt-BR': 'Inicia um quiz com perguntas sobre o mundo cripto.',
			'es-ES': 'Inicia un cuestionario con preguntas sobre el mundo de las criptomonedas.'
		})
		.addStringOption(option =>
			option
			.setName('language')
			.setDescription('Select the language of the quiz')
			.addChoices(
				{name: 'English (en)', value: 'en'},
				{name: 'Português (pt)', value: 'pt'},
				{name: 'Español (es)', value: 'es'},
			)
		),
	new SlashCommandBuilder()
		.setName('singlequiz')
		.setDescription('Inicia um quiz que não está cadastrado no banco de dados.'),
	
	new SlashCommandBuilder()
		.setName('manage')
		.setDescription('Manages the registered questions.')
].map(command => command.toJSON());

rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
	.then((data) => console.log(`Successfully registered ${data.length} global application commands.`))
	.catch(console.error);