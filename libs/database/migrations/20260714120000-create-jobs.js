'use strict';

/**
 * Creates the jobs table + indexes.
 * Run via: npm run db:migrate
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE enum_jobs_status AS ENUM (
          'queued',
          'processing',
          'completed',
          'failed',
          'retrying',
          'delayed',
          'cancelled',
          'dead_letter'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('jobs', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      idempotency_key: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      type: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      status: {
        type: 'enum_jobs_status',
        allowNull: false,
        defaultValue: 'queued',
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      available_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      last_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_status_created_at_idx
      ON jobs (status, created_at DESC);
    `);

    await queryInterface.addIndex('jobs', ['status', 'available_at'], {
      name: 'jobs_status_available_at_idx',
    });

    await queryInterface.addIndex('jobs', ['type', 'status'], {
      name: 'jobs_type_status_idx',
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_active_partial_idx
      ON jobs (status, available_at)
      WHERE status IN ('queued', 'processing', 'retrying', 'delayed');
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('jobs');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS enum_jobs_status;',
    );
  },
};
