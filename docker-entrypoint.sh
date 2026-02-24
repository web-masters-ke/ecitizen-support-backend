#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npx prisma db seed || echo "Seeding skipped or already done"

echo "Starting application..."
exec node dist/main.js
