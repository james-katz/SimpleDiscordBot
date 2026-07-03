import { DataTypes, type Sequelize } from 'sequelize';

export function defineModels(sequelize: Sequelize) {
  const ApiUser = sequelize.define('ApiUser', {
    id: { type: DataTypes.UUID, primaryKey: true },
    username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.TEXT, allowNull: false, field: 'password_hash' },
    role: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'admin' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    lastLoginAt: { type: DataTypes.DATE, field: 'last_login_at' },
  }, { tableName: 'api_users', underscored: true });

  const RefreshToken = sequelize.define('RefreshToken', {
    id: { type: DataTypes.UUID, primaryKey: true },
    apiUserId: { type: DataTypes.UUID, allowNull: false, field: 'api_user_id' },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'token_hash' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    revokedAt: { type: DataTypes.DATE, field: 'revoked_at' },
    replacedByTokenId: { type: DataTypes.UUID, field: 'replaced_by_token_id' },
  }, { tableName: 'refresh_tokens', underscored: true, updatedAt: false });

  const IdempotencyKey = sequelize.define('IdempotencyKey', {
    id: { type: DataTypes.UUID, primaryKey: true },
    apiUserId: { type: DataTypes.UUID, allowNull: false, field: 'api_user_id' },
    key: { type: DataTypes.STRING(128), allowNull: false },
    operation: { type: DataTypes.STRING(100), allowNull: false },
    requestHash: { type: DataTypes.STRING(64), allowNull: false, field: 'request_hash' },
    statusCode: { type: DataTypes.INTEGER, field: 'status_code' },
    responseJson: { type: DataTypes.TEXT, field: 'response_json' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  }, { tableName: 'idempotency_keys', underscored: true });

  const DiscordUser = sequelize.define('DiscordUser', {
    id: { type: DataTypes.UUID, primaryKey: true },
    discordUserId: { type: DataTypes.STRING(20), allowNull: false, unique: true, field: 'discord_user_id' },
    username: { type: DataTypes.STRING(64), allowNull: false },
    displayName: { type: DataTypes.STRING(128), allowNull: false, field: 'display_name' },
    avatarHash: { type: DataTypes.STRING(128), field: 'avatar_hash' },
    lastSeenAt: { type: DataTypes.DATE, allowNull: false, field: 'last_seen_at' },
  }, { tableName: 'discord_users', underscored: true });

  const Trivia = sequelize.define('Trivia', {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    language: { type: DataTypes.STRING(16), allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false },
    defaultQuestionDurationSeconds: { type: DataTypes.INTEGER, allowNull: false, field: 'default_question_duration_seconds' },
    version: { type: DataTypes.INTEGER, allowNull: false },
    isLegacy: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_legacy' },
    createdByApiUserId: { type: DataTypes.UUID, field: 'created_by_api_user_id' },
    publishedAt: { type: DataTypes.DATE, field: 'published_at' },
    archivedAt: { type: DataTypes.DATE, field: 'archived_at' },
  }, { tableName: 'trivias', underscored: true });

  const Question = sequelize.define('Question', {
    id: { type: DataTypes.UUID, primaryKey: true },
    triviaId: { type: DataTypes.UUID, allowNull: false, field: 'trivia_id' },
    prompt: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    durationSeconds: { type: DataTypes.INTEGER, field: 'duration_seconds' },
    points: { type: DataTypes.INTEGER, allowNull: false },
    prize: { type: DataTypes.DECIMAL(18, 8), allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false },
  }, { tableName: 'questions', underscored: true });

  const QuestionOption = sequelize.define('QuestionOption', {
    id: { type: DataTypes.UUID, primaryKey: true },
    questionId: { type: DataTypes.UUID, allowNull: false, field: 'question_id' },
    text: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    isCorrect: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_correct' },
  }, { tableName: 'question_options', underscored: true });

  const TriviaRun = sequelize.define('TriviaRun', {
    id: { type: DataTypes.UUID, primaryKey: true },
    triviaId: { type: DataTypes.UUID, allowNull: false, field: 'trivia_id' },
    triviaVersion: { type: DataTypes.INTEGER, allowNull: false, field: 'trivia_version' },
    status: { type: DataTypes.STRING(32), allowNull: false },
    guildId: { type: DataTypes.STRING(20), allowNull: false, field: 'guild_id' },
    channelId: { type: DataTypes.STRING(20), allowNull: false, field: 'channel_id' },
    introMessageId: { type: DataTypes.STRING(20), field: 'intro_message_id' },
    controlMessageId: { type: DataTypes.STRING(20), field: 'control_message_id' },
    currentQuestionPosition: { type: DataTypes.INTEGER, field: 'current_question_position' },
    startedByDiscordUserId: { type: DataTypes.UUID, allowNull: false, field: 'started_by_discord_user_id' },
    completedByDiscordUserId: { type: DataTypes.UUID, field: 'completed_by_discord_user_id' },
    isLegacy: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_legacy' },
    eligibleForOverall: { type: DataTypes.BOOLEAN, allowNull: false, field: 'eligible_for_overall' },
    rankingSeasonId: { type: DataTypes.UUID, field: 'ranking_season_id' },
    rankingExclusionReason: { type: DataTypes.TEXT, field: 'ranking_exclusion_reason' },
    rankingExcludedAt: { type: DataTypes.DATE, field: 'ranking_excluded_at' },
    startedAt: { type: DataTypes.DATE, field: 'started_at' },
    completedAt: { type: DataTypes.DATE, field: 'completed_at' },
    cancelledAt: { type: DataTypes.DATE, field: 'cancelled_at' },
  }, { tableName: 'trivia_runs', underscored: true });

  const RankingSeason = sequelize.define('RankingSeason', {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    startsAt: { type: DataTypes.DATE, allowNull: false, field: 'starts_at' },
    endsAt: { type: DataTypes.DATE, field: 'ends_at' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_active' },
    createdByApiUserId: { type: DataTypes.UUID, field: 'created_by_api_user_id' },
  }, { tableName: 'ranking_seasons', underscored: true });

  const RunQuestion = sequelize.define('RunQuestion', {
    id: { type: DataTypes.UUID, primaryKey: true },
    triviaRunId: { type: DataTypes.UUID, allowNull: false, field: 'trivia_run_id' },
    sourceQuestionId: { type: DataTypes.UUID, field: 'source_question_id' },
    prompt: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    durationSeconds: { type: DataTypes.INTEGER, allowNull: false, field: 'duration_seconds' },
    points: { type: DataTypes.INTEGER, allowNull: false },
    prize: { type: DataTypes.DECIMAL(18, 8), allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false },
    openedAt: { type: DataTypes.DATE, field: 'opened_at' },
    closesAt: { type: DataTypes.DATE, field: 'closes_at' },
    closedAt: { type: DataTypes.DATE, field: 'closed_at' },
    scoredAt: { type: DataTypes.DATE, field: 'scored_at' },
    resultPublishedAt: { type: DataTypes.DATE, field: 'result_published_at' },
    messageId: { type: DataTypes.STRING(20), field: 'message_id' },
  }, { tableName: 'run_questions', underscored: true });

  const RunQuestionOption = sequelize.define('RunQuestionOption', {
    id: { type: DataTypes.UUID, primaryKey: true },
    runQuestionId: { type: DataTypes.UUID, allowNull: false, field: 'run_question_id' },
    sourceOptionId: { type: DataTypes.UUID, field: 'source_option_id' },
    text: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    isCorrect: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_correct' },
  }, { tableName: 'run_question_options', underscored: true });

  const Response = sequelize.define('Response', {
    id: { type: DataTypes.UUID, primaryKey: true },
    triviaRunId: { type: DataTypes.UUID, allowNull: false, field: 'trivia_run_id' },
    runQuestionId: { type: DataTypes.UUID, allowNull: false, field: 'run_question_id' },
    discordUserId: { type: DataTypes.UUID, allowNull: false, field: 'discord_user_id' },
    selectedRunOptionId: { type: DataTypes.UUID, allowNull: false, field: 'selected_run_option_id' },
    isCorrect: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_correct' },
    pointsAwarded: { type: DataTypes.INTEGER, allowNull: false, field: 'points_awarded' },
    answeredAt: { type: DataTypes.DATE, allowNull: false, field: 'answered_at' },
  }, { tableName: 'responses', underscored: true, updatedAt: false });

  const RunScore = sequelize.define('RunScore', {
    id: { type: DataTypes.UUID, primaryKey: true },
    triviaRunId: { type: DataTypes.UUID, allowNull: false, field: 'trivia_run_id' },
    discordUserId: { type: DataTypes.UUID, allowNull: false, field: 'discord_user_id' },
    correctAnswers: { type: DataTypes.INTEGER, allowNull: false, field: 'correct_answers' },
    wrongAnswers: { type: DataTypes.INTEGER, allowNull: false, field: 'wrong_answers' },
    answeredQuestions: { type: DataTypes.INTEGER, allowNull: false, field: 'answered_questions' },
    totalPoints: { type: DataTypes.INTEGER, allowNull: false, field: 'total_points' },
  }, { tableName: 'run_scores', underscored: true });

  const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.UUID, primaryKey: true },
    apiUserId: { type: DataTypes.UUID, field: 'api_user_id' },
    action: { type: DataTypes.STRING(80), allowNull: false },
    entityType: { type: DataTypes.STRING(40), allowNull: false, field: 'entity_type' },
    entityId: { type: DataTypes.STRING(64), field: 'entity_id' },
    metadataJson: { type: DataTypes.TEXT, field: 'metadata_json' },
  }, { tableName: 'audit_logs', underscored: true, updatedAt: false });

  Trivia.hasMany(Question, { as: 'questions', foreignKey: 'triviaId' });
  Question.belongsTo(Trivia, { as: 'trivia', foreignKey: 'triviaId' });
  Question.hasMany(QuestionOption, { as: 'options', foreignKey: 'questionId' });
  QuestionOption.belongsTo(Question, { as: 'question', foreignKey: 'questionId' });
  Trivia.hasMany(TriviaRun, { as: 'runs', foreignKey: 'triviaId' });
  TriviaRun.belongsTo(Trivia, { as: 'trivia', foreignKey: 'triviaId' });
  TriviaRun.hasMany(RunQuestion, { as: 'questions', foreignKey: 'triviaRunId' });
  RunQuestion.belongsTo(TriviaRun, { as: 'run', foreignKey: 'triviaRunId' });
  RunQuestion.hasMany(RunQuestionOption, { as: 'options', foreignKey: 'runQuestionId' });
  RunQuestionOption.belongsTo(RunQuestion, { as: 'question', foreignKey: 'runQuestionId' });
  TriviaRun.hasMany(RunScore, { as: 'scores', foreignKey: 'triviaRunId' });
  RunScore.belongsTo(DiscordUser, { as: 'user', foreignKey: 'discordUserId' });
  RankingSeason.hasMany(TriviaRun, { as: 'runs', foreignKey: 'rankingSeasonId' });
  TriviaRun.belongsTo(RankingSeason, { as: 'rankingSeason', foreignKey: 'rankingSeasonId' });

  return {
    ApiUser,
    RefreshToken,
    IdempotencyKey,
    DiscordUser,
    Trivia,
    Question,
    QuestionOption,
    TriviaRun,
    RankingSeason,
    RunQuestion,
    RunQuestionOption,
    Response,
    RunScore,
    AuditLog,
  };
}

export type PlatformModels = ReturnType<typeof defineModels>;
