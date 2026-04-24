#!/bin/sh
set -e

# Append connection pool settings to DATABASE_URL if not already set.
# connection_limit=20 supports many concurrent super-admin sessions without exhausting DB.
if [ -n "$DATABASE_URL" ] && ! echo "$DATABASE_URL" | grep -q "connection_limit"; then
  export DATABASE_URL="${DATABASE_URL}?connection_limit=20&pool_timeout=30"
fi

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
