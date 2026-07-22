import { DataTypes, type QueryInterface } from 'sequelize';

const timestamps = {
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
};

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('api_users', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    password_hash: { type: DataTypes.TEXT, allowNull: false },
    role: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'admin' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    ...timestamps,
  });

  await queryInterface.createTable('refresh_tokens', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    api_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'api_users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
    replaced_by_token_id: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('refresh_tokens', ['api_user_id', 'expires_at'], {
    name: 'refresh_tokens_user_expiry',
  });

  await queryInterface.createTable('discord_users', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    discord_user_id: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    username: { type: DataTypes.STRING(64), allowNull: false },
    display_name: { type: DataTypes.STRING(128), allowNull: false },
    avatar_hash: { type: DataTypes.STRING(128), allowNull: true },
    last_seen_at: { type: DataTypes.DATE, allowNull: false },
    ...timestamps,
  });

  await queryInterface.createTable('trivias', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    language: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'en' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'draft' },
    default_question_duration_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 40 },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    created_by_api_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'api_users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    published_at: { type: DataTypes.DATE, allowNull: true },
    archived_at: { type: DataTypes.DATE, allowNull: true },
    ...timestamps,
  });
  await queryInterface.addIndex('trivias', ['status', 'created_at'], { name: 'trivias_status_created' });

  await queryInterface.createTable('questions', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    trivia_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'trivias', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    prompt: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
    points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    prize: { type: DataTypes.DECIMAL(18, 8), allowNull: false, defaultValue: 0 },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    ...timestamps,
  });
  await queryInterface.addIndex('questions', ['trivia_id', 'position'], {
    name: 'questions_trivia_position',
    unique: true,
  });

  await queryInterface.createTable('question_options', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    question_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'questions', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    text: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    is_correct: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ...timestamps,
  });
  await queryInterface.addIndex('question_options', ['question_id', 'position'], {
    name: 'question_options_question_position',
    unique: true,
  });
  await queryInterface.addIndex('question_options', ['question_id'], {
    name: 'question_options_one_correct',
    unique: true,
    where: { is_correct: true },
  });

  await queryInterface.createTable('trivia_runs', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    trivia_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'trivias', key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
    trivia_version: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'waiting' },
    guild_id: { type: DataTypes.STRING(20), allowNull: false },
    channel_id: { type: DataTypes.STRING(20), allowNull: false },
    intro_message_id: { type: DataTypes.STRING(20), allowNull: true },
    control_message_id: { type: DataTypes.STRING(20), allowNull: true },
    current_question_position: { type: DataTypes.INTEGER, allowNull: true },
    started_by_discord_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'discord_users', key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
    completed_by_discord_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'discord_users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    eligible_for_overall: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    ...timestamps,
  });
  await queryInterface.addIndex('trivia_runs', ['channel_id', 'status'], { name: 'trivia_runs_channel_status' });
  await queryInterface.addIndex('trivia_runs', ['trivia_id', 'status'], { name: 'trivia_runs_trivia_status' });

  await queryInterface.createTable('run_questions', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    trivia_run_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'trivia_runs', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    source_question_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'questions', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    prompt: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    duration_seconds: { type: DataTypes.INTEGER, allowNull: false },
    points: { type: DataTypes.INTEGER, allowNull: false },
    prize: { type: DataTypes.DECIMAL(18, 8), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    opened_at: { type: DataTypes.DATE, allowNull: true },
    closes_at: { type: DataTypes.DATE, allowNull: true },
    closed_at: { type: DataTypes.DATE, allowNull: true },
    scored_at: { type: DataTypes.DATE, allowNull: true },
    result_published_at: { type: DataTypes.DATE, allowNull: true },
    message_id: { type: DataTypes.STRING(20), allowNull: true },
    ...timestamps,
  });
  await queryInterface.addIndex('run_questions', ['trivia_run_id', 'position'], {
    name: 'run_questions_run_position',
    unique: true,
  });
  await queryInterface.addIndex('run_questions', ['status', 'closes_at'], { name: 'run_questions_due' });

  await queryInterface.createTable('run_question_options', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    run_question_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'run_questions', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    source_option_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'question_options', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    text: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    is_correct: { type: DataTypes.BOOLEAN, allowNull: false },
    ...timestamps,
  });
  await queryInterface.addIndex('run_question_options', ['run_question_id', 'position'], {
    name: 'run_question_options_question_position',
    unique: true,
  });

  await queryInterface.createTable('responses', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    trivia_run_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'trivia_runs', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    run_question_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'run_questions', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    discord_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'discord_users', key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
    selected_run_option_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'run_question_options', key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
    is_correct: { type: DataTypes.BOOLEAN, allowNull: false },
    points_awarded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    answered_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('responses', ['run_question_id', 'discord_user_id'], {
    name: 'responses_one_per_question_user',
    unique: true,
  });
  await queryInterface.addIndex('responses', ['trivia_run_id', 'discord_user_id'], {
    name: 'responses_run_user',
  });

  await queryInterface.createTable('run_scores', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    trivia_run_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'trivia_runs', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    discord_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'discord_users', key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
    correct_answers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    wrong_answers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    answered_questions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...timestamps,
  });
  await queryInterface.addIndex('run_scores', ['trivia_run_id', 'discord_user_id'], {
    name: 'run_scores_run_user',
    unique: true,
  });
  await queryInterface.addIndex('run_scores', ['trivia_run_id', 'total_points', 'correct_answers'], {
    name: 'run_scores_ranking',
  });

  await queryInterface.createTable('audit_logs', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    api_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'api_users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    action: { type: DataTypes.STRING(80), allowNull: false },
    entity_type: { type: DataTypes.STRING(40), allowNull: false },
    entity_id: { type: DataTypes.STRING(64), allowNull: true },
    metadata_json: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id', 'created_at'], {
    name: 'audit_logs_entity_created',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('audit_logs');
  await queryInterface.dropTable('run_scores');
  await queryInterface.dropTable('responses');
  await queryInterface.dropTable('run_question_options');
  await queryInterface.dropTable('run_questions');
  await queryInterface.dropTable('trivia_runs');
  await queryInterface.dropTable('question_options');
  await queryInterface.dropTable('questions');
  await queryInterface.dropTable('trivias');
  await queryInterface.dropTable('discord_users');
  await queryInterface.dropTable('refresh_tokens');
  await queryInterface.dropTable('api_users');
}
