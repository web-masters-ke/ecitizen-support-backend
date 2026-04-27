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

echo "Seeding all 583 agencies..."
if npx ts-node --transpile-only prisma/seed-agencies.ts; then
  echo "✅ Agencies seeded"
else
  echo "⚠️  Agency seed failed or already seeded, continuing..."
fi

echo "Seeding agency admin users..."
if npx ts-node --transpile-only prisma/seed-agency-users.ts; then
  echo "✅ Agency users seeded"
else
  echo "⚠️  Agency user seed failed or already seeded, continuing..."
fi

echo "Updating agencies with onboarding report data..."
if npx ts-node --transpile-only prisma/seed-agency-updates.ts; then
  echo "✅ Agency onboarding data updated"
else
  echo "⚠️  Agency update failed, continuing..."
fi

echo "Starting application..."
exec node dist/main.js
