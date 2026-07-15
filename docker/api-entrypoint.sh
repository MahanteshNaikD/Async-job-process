#!/bin/sh
set -e

echo "Running database migrations..."
node libs/database/src/migrate.js

echo "Starting API..."
exec node dist/apps/api/main.js
