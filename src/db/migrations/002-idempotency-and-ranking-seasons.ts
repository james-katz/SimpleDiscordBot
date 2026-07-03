import { DataTypes, type QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('idempotency_keys', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    api_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'api_users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    key: { type: DataTypes.STRING(128), allowNull: false },
    operation: { type: DataTypes.STRING(100), allowNull: false },
    request_hash: { type: DataTypes.STRING(64), allowNull: false },
    status_code: { type: DataTypes.INTEGER, allowNull: true },
    response_json: { type: DataTypes.TEXT, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('idempotency_keys', ['api_user_id', 'key'], {
    name: 'idempotency_keys_user_key',
    unique: true,
  });
  await queryInterface.addIndex('idempotency_keys', ['expires_at'], {
    name: 'idempotency_keys_expiry',
  });

  await queryInterface.createTable('ranking_seasons', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    starts_at: { type: DataTypes.DATE, allowNull: false },
    ends_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_by_api_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'api_users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('ranking_seasons', ['is_active'], {
    name: 'ranking_seasons_one_active',
    unique: true,
    where: { is_active: true },
  });

  await queryInterface.addColumn('trivia_runs', 'ranking_season_id', {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'ranking_seasons', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });
  await queryInterface.addColumn('trivia_runs', 'ranking_exclusion_reason', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await queryInterface.addColumn('trivia_runs', 'ranking_excluded_at', {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await queryInterface.addIndex('trivia_runs', ['ranking_season_id', 'status'], {
    name: 'trivia_runs_season_status',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex('trivia_runs', 'trivia_runs_season_status');
  await queryInterface.removeColumn('trivia_runs', 'ranking_excluded_at');
  await queryInterface.removeColumn('trivia_runs', 'ranking_exclusion_reason');
  await queryInterface.removeColumn('trivia_runs', 'ranking_season_id');
  await queryInterface.dropTable('ranking_seasons');
  await queryInterface.dropTable('idempotency_keys');
}
