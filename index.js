const { Client, GatewayIntentBits, ModalSubmitInteraction } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const dotenv = require('dotenv');
const Trivia = require('./trivia');
const sequelize = require('./sequelize/index');

dotenv.config();

const client = new Client({
     intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,    
    ],
 });

console.log("Booting...");

const RANK_PAGE_SIZE = 10;
const RANK_RESET_ROLE_ID = '1078741799306268727';
const LEGACY_COMMANDS_ENABLED = process.env.LEGACY_COMMANDS_ENABLED === 'true';

client.once('ready', () => {
    console.log("Ready!");    
});

sequelize.authenticate()
.then(async () => {
    await sequelize.sync();
    console.log('Database up and running!');
})
.catch(err => {
    console.log('Fatal: No connection to the database!');
    console.log(err);
    process.exit(1);
});

async function getSequentialQuestions(lang = 'pt') {
    return sequelize.models.question.findAll({
        where: {
            language: lang
        },
        order: [['id', 'ASC']]
    });
}

function getRankEmoji(position) {
    if (position === 1) return '🏆';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '🏅';
}

async function getRankPage(page) {
    const safePage = Math.max(0, page);
    const { count, rows } = await sequelize.models.rank.findAndCountAll({
        order: [
            ['correctAnswers', 'DESC'],
            ['wrongAnswers', 'ASC'],
            ['updatedAt', 'ASC']
        ],
        limit: RANK_PAGE_SIZE,
        offset: safePage * RANK_PAGE_SIZE
    });

    return {
        rows,
        totalUsers: count,
        totalPages: Math.max(1, Math.ceil(count / RANK_PAGE_SIZE)),
        page: safePage
    };
}

async function buildRankMessage(requesterId, page) {
    const rankPage = await getRankPage(page);
    const currentPage = Math.min(rankPage.page, rankPage.totalPages - 1);
    const pageData = currentPage === rankPage.page ? rankPage : await getRankPage(currentPage);

    const embed = new EmbedBuilder()
        .setColor(0xf4b728)
        .setTitle('Trivia Ranking')
        .setFooter({ text: `Page ${currentPage + 1}/${pageData.totalPages} • ${pageData.totalUsers} ranked users` })
        .setTimestamp();

    if (!pageData.rows.length) {
        embed.setDescription('No ranking data yet.');
    }
    else {
        const startPosition = currentPage * RANK_PAGE_SIZE;
        for (let i = 0; i < pageData.rows.length; i++) {
            const rankEntry = pageData.rows[i];
            const position = startPosition + i + 1;
            const trophy = getRankEmoji(position);
            const label = `${trophy} #${position} Lugar`;
            embed.addFields({
                name: label,
                value: `<@${rankEntry.userId}>\nAcertos: ${rankEntry.correctAnswers}\nErros: ${rankEntry.wrongAnswers}`,
                inline: false
            });
        }
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rank_prev_${requesterId}_${currentPage}`)
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`rank_next_${requesterId}_${currentPage}`)
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= pageData.totalPages - 1)
    );

    return {
        embeds: [embed],
        components: [row]
    };
}

function memberHasRole(interaction, roleId) {
    if (!interaction.inGuild()) return false;

    const roles = interaction.member?.roles;
    if (roles?.cache) return roles.cache.has(roleId);

    return Array.isArray(roles) && roles.includes(roleId);
}

client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId.startsWith('rank_')) {
        const [, direction, ownerId, pageValue] = interaction.customId.split('_');
        const currentPage = Number(pageValue);

        if (interaction.user.id !== ownerId) {
            await interaction.reply({
                content: 'Only the user who opened this ranking can navigate it.',
                ephemeral: true
            });
            return;
        }

        const targetPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
        const message = await buildRankMessage(ownerId, targetPage);
        await interaction.update(message);
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    if (['jasperquiz', 'singlequiz', 'reset-ranking'].includes(commandName) && !LEGACY_COMMANDS_ENABLED) {
        await interaction.reply({
            content: 'This legacy command is disabled.',
            ephemeral: true
        });
        return;
    }
    if(commandName === 'jasperquiz') {    
        await interaction.deferReply();

        if(interaction.user.id !== '290336959627395072') {
            interaction.editReply({embeds: [{
                color: 0xff0000,
                title: '🚫 Sem permissão!',
                description: `Apenas o grande <@1122272347827732686> podo usar esse comando.`
            }]});
            return;
        }
        
        let prize = "";
        prize = interaction.options.getString('prize');
        if(!prize) {
            interaction.editReply({embeds: [{
                color: 0xff0000,
                title: '🚫 This command requires a prize amnount!',
                description: 'Please inform a tip amount less than $5 USD.'
            }]});
            return;
        }

        prize = prize.replace(/,/g, '.');

        console.log('Um quiz foi iniciado por ' + interaction.user.username + '.');        
        
        let lang = interaction.options.getString('language');

        let validLang = lang == 'pt' || lang == 'en' || lang == 'es';
        if(!validLang) {
            lang = 'pt';
        }
        lang = 'pt';
        let questionIdx = 0;

        getSequentialQuestions(lang)
        .then(questions => {
            if(!questions.length) {
                console.log('no question received')
                interaction.editReply({content:'Acabaram-se as perguntas'});

                return;
            }
            console.log(`Starting question ${questionIdx}\n\n`);
            let question = questions[questionIdx];
            let trivia = new Trivia(interaction, question, lang, prize);
            trivia.startTrivia(questionIdx);
            questionIdx ++;
            
            let timer = setInterval(async () => {
                console.log(`Starting question ${questionIdx}\n\n`);
                
                setTimeout(async() => {
                    let question = questions[questionIdx];
                    
                    let trivia = new Trivia(interaction, question, lang, prize);    
                    trivia.startTrivia(questionIdx);
                    questionIdx ++;
                    if(questionIdx >= questions.length) {
                        console.log("clearing timer")
                        clearInterval(timer);
                    }
                }, 100);                
            }, 60*1000);           
        })
        .catch(err => {
            interaction.editReply({content:'Unable to connect to the database server ☹️\nPlease contact the administrator and inform the code: ' + err.code});
            console.log(err);
        });
    }
    else if(commandName === 'singlequiz') {        
        let prize = "";
        prize = interaction.options.getString('prize');
        if(prize) prize = prize.replace(/,/g, '.');

        const quizModal = new ModalBuilder()
            .setCustomId(`quizmodal_${interaction.id}`)
            .setTitle('ZecQuiz');

        const questionInput = new TextInputBuilder()
            .setCustomId('question')
            .setLabel('Enunciado / Pergunta')            
            .setStyle(TextInputStyle.Paragraph);

        const answerAInput = new TextInputBuilder()
            .setCustomId('answer_0')
            .setLabel('Resposta correta')
            // .setMaxLength(80)
            .setStyle(TextInputStyle.Short);

        const answerBInput = new TextInputBuilder()
            .setCustomId('answer_1')
            .setLabel('Resposta incorreta')
            // .setMaxLength(80)
            .setStyle(TextInputStyle.Short);
        
        const answerCInput = new TextInputBuilder()
            .setCustomId('answer_2')
            .setLabel('Resposta incorreta')
            // .setMaxLength(80)
            .setRequired(false)
            .setStyle(TextInputStyle.Short);

        const answerDInput = new TextInputBuilder()
            .setCustomId('answer_3')
            .setLabel('Resposta incorreta')
            // .setMaxLength(80)
            .setRequired(false)
            .setStyle(TextInputStyle.Short);

        const questionInputRow = new ActionRowBuilder().addComponents(questionInput);
        const answerAInputRow = new ActionRowBuilder().addComponents(answerAInput);
        const answerBInputRow = new ActionRowBuilder().addComponents(answerBInput);
        const answerCInputRow = new ActionRowBuilder().addComponents(answerCInput);
        const answerDInputRow = new ActionRowBuilder().addComponents(answerDInput);

        quizModal.addComponents(questionInputRow, answerAInputRow, answerBInputRow, answerCInputRow, answerDInputRow);

        await interaction.showModal(quizModal).catch(err => console.log(err));

        const filter = (i) => i.customId === `quizmodal_${interaction.id}`;
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

            let trivia = new Trivia(modalInteraction, question, 'pt', prize);
            setTimeout(() => {
                trivia.startTrivia();    
            }, 1000);            
        }).catch((err) => {
            if (err.name === 'InteractionCollectorError' && err.message.includes('reason: time')) {
                return;
            }

            console.log(err);
        });
    }
    else if(commandName === 'rank') {
        await interaction.deferReply();

        try {
            const message = await buildRankMessage(interaction.user.id, 0);
            await interaction.editReply(message);
        }
        catch (err) {
            console.log(err);
            await interaction.editReply({
                content: 'Unable to load the ranking right now.'
            });
        }
    }
    else if(commandName === 'reset-ranking') {
        if (!memberHasRole(interaction, RANK_RESET_ROLE_ID)) {
            await interaction.reply({
                content: 'You do not have permission to reset the ranking.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const deletedEntries = await sequelize.transaction(async transaction => {
                return sequelize.models.rank.destroy({
                    where: {},
                    transaction
                });
            });

            console.log(`Ranking reset by ${interaction.user.username} (${interaction.user.id}). Deleted ${deletedEntries} entries.`);
            await interaction.editReply({
                content: `Ranking reset successfully. Deleted ${deletedEntries} entries.`
            });
        }
        catch (err) {
            console.log('Unable to reset ranking:', err);
            await interaction.editReply({
                content: 'Unable to reset the ranking right now.'
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
