# Styled By C

## Run
npm install
npm run dev

## Migrate DB
npm run db:migrate

## Create owner
Set OWNER_EMAIL and OWNER_PASSWORD in .env.local, then:
npx tsx scripts/create-owner.ts
Delete OWNER_PASSWORD from .env.local afterwards.

## Reset owner password
npx tsx scripts/create-owner.ts (upsert by email)
