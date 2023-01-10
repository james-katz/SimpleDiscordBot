class Localization {
    constructor(lang) {
        this.lang = lang;        
        
        this.pt = {
            triviaStartTitle: '🤔 Um quiz foi iniciado!',
            triviaStartDescription: 'iniciou um quiz pra galera! Leia atentamente e escolha sua resposta!',
            triviaStartQuestionIs: 'A pergunta é:',
            triviaStartEndsIn: 'Finaliza em 45 segundos!',
            triviaEndedTitle: '🤔 O quiz chegou ao fim!',
            triviaEndedNoOne: 'Ninguém participou do quiz iniciado por',
            triviaEndedQuestion: 'com a pergunta:',
            triviaEndedFooter: 'Finalizado!',
            triviaEndedUser: 'pessoa participou.',
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
            triviaStartEndsIn: 'Ends in 45 seconds!',
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

        this.es = {
            triviaStartTitle: '🤔 Se ha iniciado un cuestionario.! ',
            triviaStartDescription: 'comenzó una prueba para todos! ¡Lee atentamente y elige tu respuesta!',
            triviaStartQuestionIs: 'La pregunta es:',
            triviaStartEndsIn: 'Termina en 1 minuto!',
            triviaEndedTitle: '🤔 ¡El cuestionario ha llegado a su fin!',
            triviaEndedNoOne: 'Nadie participó en el cuestionario iniciado por',
            triviaEndedQuestion: 'con la pregunta:',
            triviaEndedFooter: '¡Acabado!',
            triviaEndedUser: 'persona participó.',
            triviaEndedUsers: 'personas participaron.',
            triviaEndedUserGuess: 'persona acertó',
            triviaEndedUsersGuess: 'personas acertaron ',
            triviaEndedTriviaBy: 'la pergunta de',
            triviaEndedCorrect: 'Correcto',
            triviaEndedIncorrect: 'Incorrecto',
            triviaEndedNoLosers: '¡Que maravilla! ¡Nadie se equivocó!',
            triviaEndedNoWinners: 'Nadie acertó el cuestionario por',
            triviaErrorOwnTrivia: '⚠️ ¡No puede participar en un quiz que usted creó!',
            triviaErrorJoined: '⚠️ ¡Ya estás participando en este concurso!'
        };

        this.text = this.pt;
        if(this.lang == 'en') this.text = this.en;
        if(this.lang == 'es') this.text = this.es;
    }
}

module.exports = Localization;