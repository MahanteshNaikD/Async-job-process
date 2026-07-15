/**
 * Umzug + Sequelize migration runner.
 * Usage: npm run db:migrate
 */
require('dotenv').config();
const path = require('path');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');

async function main() {
  const sequelize = new Sequelize(
    process.env.DATABASE_NAME ?? 'async_jobs',
    process.env.DATABASE_USER ?? 'jobs',
    process.env.DATABASE_PASSWORD ?? 'jobs',
    {
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      dialect: 'postgres',
      logging: console.log,
    },
  );

  await sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  const umzug = new Umzug({
    migrations: {
      glob: path.join(__dirname, '../migrations/*.js'),
      resolve: ({ name, path: migrationPath, context }) => {
        // Support classic sequelize-cli style: up(queryInterface, Sequelize)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const migration = require(migrationPath);
        return {
          name,
          up: async () => migration.up(context, Sequelize),
          down: async () => migration.down(context, Sequelize),
        };
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  const command = process.argv[2] ?? 'up';

  if (command === 'down') {
    await umzug.down();
  } else if (command === 'pending') {
    const pending = await umzug.pending();
    console.log(pending.map((m) => m.name));
  } else {
    const executed = await umzug.up();
    console.log(
      'Migrations executed:',
      executed.map((m) => m.name),
    );
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
