const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Localization = require('./localization');

class Trivia {
    constructor(interaction, question, lang, prize) {
        this.interaction = interaction;
        this.question = question;
        this.lang = lang;
        this.participants = [];
        this.prize = prize || "";
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
        let quiz = this.question;
        let shuffledAnswers = this.fyShuffle(quiz.answers);
        let answerList = "";
        let letterCount = 0;
        for(let answer of shuffledAnswers) {    
            let letter;
            switch(letterCount) {
                case 0:
                    letter = "🇦";
                    break;
                case 1:
                    letter = "🇧";
                    break;
                case 2:
                    letter = "🇨";
                    break;
                case 3:
                    letter = "🇩";
                    break;
            }        
            answerList += `${letter}) ${answer}\n`;
            letterCount ++;
        }

        const local = new Localization(this.lang);

        let embedQuiz = new EmbedBuilder()
            .setColor(0xf4b728)
            .setTitle(local.text.triviaStartTitle)
            .setDescription('<@' + this.interaction.user.id +'> ' + local.text.triviaStartDescription)
            .addFields(
                {name:'\u200B', value:'**'+ local.text.triviaStartQuestionIs +'** ' + quiz.question},
            )
            .addFields(
                {name:'\u200B', value:'**'+ local.text.triviaStartAnswers +'**\n' + answerList},
            )
            .setTimestamp()
            .setFooter({text: local.text.triviaStartEndsIn});

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
                // .setLabel(shuffledAnswers[i].substring(0,80))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emoji);
        }
        let row = new ActionRowBuilder().addComponents(buttons);

        this.interaction.editReply( {embeds: [embedQuiz], components: [row]} )
            .then(triviaMsg => {
                const collector = triviaMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 45 * 1000 });
                
                collector.on('collect', i => {                    
                    if(i.user.id === this.interaction.user.id) {
                        i.reply({embeds: [{
                            title: local.text.triviaErrorOwnTrivia,
                            color: 0xff0000
                        }], ephemeral: true});
                        return false;
                    };
                    for(let j = 0; j < this.participants.length; j ++) {                        
                        if(this.participants[j].user === i.user.id) {
                            i.reply({embeds: [{
                                title: local.text.triviaErrorJoined,
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
                        .setTitle(local.text.triviaEndedTitle)
                        .setDescription(local.text.triviaEndedNoOne + ' <@'+this.interaction.user.id+'> '+ local.text.triviaEndedQuestion + ' ' + quiz.question + ' 🤷.')
                        .addFields(
                            {name:'\u200B', value:'**'+ local.text.triviaStartAnswers +'**\n' + answerList},
                        )
                        .setTimestamp()
                        .setFooter({text: local.text.triviaEndedFooter + ' ' + this.participants.length + ' ' + (this.participants.length == 1 ? local.text.triviaEndedUser : local.text.triviaEndedUsers)});

                    if(collected.size > 0) {                        
                        for(let j = 0; j < this.participants.length; j ++) {
                            if(this.participants[j].guess == correctAnswer) winners.push('<@'+this.participants[j].user+'>');
                            else loosers.push('<@'+this.participants[j].user+'>');
                        }
                        if(winners.length > 0) {
                            triviaFinished.data.description = winners.length + (winners.length == 1 ? (' '+ local.text.triviaEndedUserGuess +' ') : (' ' + local.text.triviaEndedUsersGuess + ' ')) + local.text.triviaEndedTriviaBy +' <@' + this.interaction.user.id +'> ' + local.text.triviaEndedQuestion + ' ' + quiz.question;
                           
                            triviaFinished.addFields(
                                { name: '**' + local.text.triviaEndedCorrect + '**', value: winners.join('\n'), inline: true },
                                { name: '**' + local.text.triviaEndedIncorrect + '**', value: (loosers.length > 0 ? loosers.join('\n') : local.text.triviaEndedNoLosers), inline: true }
                            );
                        }
                        else {
                            triviaFinished.data.description = local.text.triviaEndedNoWinners + ' <@'+this.interaction.user.id+'> ' + local.text.triviaEndedQuestion + ' ' + quiz.question + ' 🤷.';
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
                                // let tip = 'Ninguém acertou, ninguém recebe tips!';
                                if(winners.length > 0 && this.prize) {
                                    let tip = '$ztip ' + winners.join(' ') + '$'+this.prize +' ZecQuiz';
                                    this.interaction.followUp({content: tip});
                                }
                            }, 800);
                        })
                        .catch((err) => console.log('Error: ' + err));
                });
            });
    }
}

module.exports = Trivia;
