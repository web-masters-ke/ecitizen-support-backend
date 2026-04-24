#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Seeding database..."
if npx prisma db seed; then
  echo "✅ Seed complete"
else
  seed_exit=$?
  echo "⚠️  Seed exited with code $seed_exit — data may already exist, continuing..."
fi

echo "Starting application..."
exec node dist/main.js
