class Localization {
    constructor(lang) {
        this.lang = lang;        
        
        this.pt = {
            triviaStartTitle: '🤔 Um quiz foi iniciado!',
            triviaStartDescription: 'iniciou um quiz pra galera! Leia atentamente e escolha sua resposta!',
            triviaStartQuestionIs: 'A pergunta é:',
            triviaStartEndsIn: 'Finaliza em 1 minuto!',
            triviaEndedTitle: '🤔 O quiz chegou ao fim!',
            triviaEndedNoOne: 'Ninguém participou do quiz iniciado por',
            triviaEndedQuestion: 'com a pergunta:',
            triviaEndedFooter: 'Finalizado!',
            triviaEndedUser: 'pessoa particiou.',
            triviaEndedUsers: 'pessoas participaram.',
            triviaEndedUserGuess: 'pessoa acertou',
            triviaEndedUsersGuess: 'pessoas acertaram',
            triviaEndedTriviaBy: 'o quiz de',
            triviaEndedCorrect: 'Correto',
            triviaEndedIncorrect: 'Incorreto',
            triviaEndedNoLosers: 'Que maravilha! Ninguém errou!',
            triviaEndedNoWinners: 'Ninguém acertou o quiz iniciado por',
            triviaErrorOwnTrivia: '⚠️ Você não pode participar de um quiz que você criou!',
            triviaErrorJoined: '⚠️ Você já está participando desse quiz!'
        };

        this.en = {
            triviaStartTitle: '🤔 Trivia time! ',
            triviaStartDescription: 'wants to test your knowledge! Read carefully and pick your guess!',
            triviaStartQuestionIs: 'The question is:',
            triviaStartEndsIn: 'Ends in 1 minute!',
            triviaEndedTitle: '🤔 Trivia ended!',
            triviaEndedNoOne: 'No one entered the trivia initiated by',
            triviaEndedQuestion: 'with the question:',
            triviaEndedFooter: 'Ended!',
            triviaEndedUser: 'user entered.',
            triviaEndedUsers: 'users entered.',
            triviaEndedUserGuess: 'user guessed correctly',
            triviaEndedUsersGuess: 'users guessed correctly',
            triviaEndedTriviaBy: 'the trivia by',
            triviaEndedCorrect: 'Correct',
            triviaEndedIncorrect: 'Incorrect',
            triviaEndedNoLosers: 'Awesome! Everyone guessed correctly!',
            triviaEndedNoWinners: 'No one guessed correctly the trivia initiated by',
            triviaErrorOwnTrivia: '⚠️ You cannot participate in a trivia initiated by yourself!',
            triviaErrorJoined: '⚠️ You\'ve already picked you guess!'
        };

        this.text = this.pt;
        if(this.lang == 'en') this.text = this.en;
    }
}

module.exports = Localization;