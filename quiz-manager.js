const {  ModalBuilder, ActionRowBuilder, SelectMenuBuilder, TextInputBuilder, TextInputStyle, InteractionCollector } = require('discord.js');

module.exports = function(i) {
    const quizManager = new ModalBuilder()
        .setCustomId('quizManagerModal')
        .setTitle('Gerenciador ZecQuiz');

    const questionManager = new ActionRowBuilder();
    questionManager.addComponents(
        new TextInputBuilder()
            .setCustomId('question_0')
            .setLabel('Enunciado')
            .setStyle(TextInputStyle.Paragraph)
    );
        
    quizManager.addComponents(questionManager);

    i.showModal(quizManager);
};