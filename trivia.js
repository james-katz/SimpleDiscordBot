const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

class Trivia {
    constructor(interaction, questions) {
        this.interaction = interaction;
        this.questions = questions;
        this.participants = [];
    }

    fyShuffle(oldArr) {
        let arr = JSON.parse(JSON.stringify(oldArr));
        let i = arr.length; 
        while (--i > 0) {
          let randIndex = Math.floor(Math.random() * (i + 1));
          [arr[randIndex], arr[i]] = [arr[i], arr[randIndex]];
        }        
        return arr;
      }

    startTrivia() {
        let idx = Math.floor(Math.random() * this.questions.length);
        let quiz = this.questions[idx];
        let shuffledAnswers = this.fyShuffle(quiz.answers);

        let embedQuiz = new EmbedBuilder()
            .setColor(0xf4b728)
            .setTitle('🤔 Um quiz foi iniciado!')
            .setDescription('<@' + this.interaction.user.id +'> iniciou um quiz pra galera! Leia atentamente e escolha sua resposta!')
            .addFields(
                {name:'\u200B', value:'**A pergunta é: **' + quiz.question},
            )
            .setTimestamp()
            .setFooter({text: 'Finaliza em 1 minuto!'});

        var buttons = [];
        var correctAnswer = '';
        let emoji = "";        
        for(let i = 0; i < shuffledAnswers.length; i ++) {
            if(shuffledAnswers[i] == quiz.answers[0]) {
                correctAnswer = "answer_" + i;
                
            }
            
            switch(i) {
                case 0:
                    emoji = "🇦";
                    break;
                case 1:
                    emoji = "🇧";
                    break;
                case 2:
                    emoji = "🇨";
                    break;
                case 3:
                    emoji = "🇩";
                    break;
                
            }
            buttons[i] = new ButtonBuilder()
                .setCustomId('answer_'+i)
                .setLabel(shuffledAnswers[i])
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emoji);
        }
        let row = new ActionRowBuilder().addComponents(buttons);

        this.interaction.editReply( {embeds: [embedQuiz], components: [row]} )
            .then(triviaMsg => {
                const collector = triviaMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 10 * 1000 });
                
                collector.on('collect', i => {                    
                    if(i.user.id === this.interaction.user.id) {
                        i.reply({embeds: [{
                            title: '⚠️ Você não pode participar de um quiz que você criou!',
                            color: 0xff0000
                        }], ephemeral: true});
                        return false;
                    };
                    for(let j = 0; j < this.participants.length; j ++) {                        
                        if(this.participants[j].user === i.user.id) {
                            i.reply({embeds: [{
                                title: '⚠️ Você já está participando desse quiz!',
                                color: 0xff0000
                            }], ephemeral: true});
                            return false;
                        }
                    }
                    
                    let userGuess = {user: i.user.id, guess: i.customId};
                    this.participants.push(userGuess);
                    
                    i.deferUpdate();
                });
                
                collector.on('end', collected => {
                    var winners = [];
                    var loosers = [];

                    let triviaFinished = new EmbedBuilder()
                        .setColor(0xf4b728)
                        .setTitle('🤔 O quiz chegou ao fim!')
                        .setDescription('Ninguém participou do quiz iniciado por <@'+this.interaction.user.id+'> com a pergunta: '+quiz.question+' 🤷.')
                        .setTimestamp()
                        .setFooter({text: 'Finalizado! '+this.participants.length+ ' ' + (this.participants.length == 1 ? 'pessoa participou.' : 'pessoas participaram.')});

                    if(collected.size > 0) {                        
                        for(let j = 0; j < this.participants.length; j ++) {
                            if(this.participants[j].guess == correctAnswer) winners.push('<@'+this.participants[j].user+'>');
                            else loosers.push('<@'+this.participants[j].user+'>');
                        }
                        if(winners.length > 0) {
                            triviaFinished.data.description = winners.length + (winners.length == 1 ? ' pessoa acertou ' : ' pessoas acertaram ') + 'o quiz de <@' + this.interaction.user.id +'> com a pergunnta: ' + quiz.question;
                            triviaFinished.addFields(
                                { name: '**Correto**', value: winners.join('\n'), inline: true },
                                { name: '**Incorreto**', value: (loosers.length > 0 ? loosers.join('\n') : 'Que maravilha! Ninguém errou!'), inline: true }
                            );
                        }
                        else {
                            triviaFinished.data.description = 'Ninguém acertou o quiz iniciado por <@'+this.interaction.user.id+'> com a pergunta: '+quiz.question+' 🤷.';
                        }
                    }
                    
                    for(let j = 0; j < buttons.length; j ++) {
                        buttons[j].data.disabled = true;
                        if(buttons[j].data.custom_id == correctAnswer) {
                            buttons[j].data.style = ButtonStyle.Success;                            
                        }
                    }

                    let row = new ActionRowBuilder().addComponents(buttons);

                    this.interaction.editReply( {embeds: [triviaFinished], components: [row]} )
                        .then(() => {
                            setTimeout(() => {
                                let tip = 'Ninguém acertou, ninguém recebe tips!';
                                if(winners.length > 0) tip = 'O comando para enviar prêmio aos vencedores é: $tip ' + winners.join(', ') + ' <valor> <token>';
                                this.interaction.followUp({content: tip, ephemeral: true});
                            }, 800);
                        })
                        .catch((err) => console.log('Error: ' + err));
                });
            });
    }
}

module.exports = Trivia;
