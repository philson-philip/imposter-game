# Imposter – Malayalam Party Word Game

A pass-the-phone or play-on-your-own-phone party game for Malayalam speaker. Everyone gets the same
secret word, except the Imposter. Give clues, vote, and find them out.

## Modes

- **Online rooms** – the host creates a room and shares a 5-character code or link. Friends join
  on their own phones. The host picks the category per round, starts rounds, and can end the game.
  Clues can be typed in the app (turn-based) or spoken out loud. Voting is secret on each phone.
  An innocent player voted out sits out until the next round. The host can continue with more
  clues and votes using the same word and imposter, or end the round and award the imposter a win.
- **Pass & play** – one phone passed around the group. No account, no network needed after load.

Scoring: crew members earn 1 point each for voting out the Imposter; the Imposter earns 3 for
surviving until the host ends the round, or 2 for guessing the word after being caught. Words are never repeated in a
session until a category runs dry.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # unit tests for the game and room logic
pnpm typecheck
pnpm lint
```

Room state lives in Redis (Upstash via the Vercel Marketplace). Without `UPSTASH_REDIS_REST_URL`
and `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`) the server falls back
to an in-memory store in development only. Production requires Redis: server memory is not
shared between serverless instances and can disappear at any time. Rooms expire after 12 hours
without a persisted update; room actions and presence updates renew that lifetime.

```bash
vercel env pull .env.local   # after the Upstash integration is connected to the project
```

Connect Redis to the production environment and redeploy after adding its credentials.
Changing the TTL alone cannot keep rooms alive without persistent storage.

## Word lists

`src/data/words.ts` holds 10 Kerala-themed categories (food, movies, movie characters, festivals,
Gulf life, college, places, daily life, sports, nature) with Malayalam script and English
transliterations. Edit freely.

## Deploy

The project is a standard Next.js app; `vercel deploy --prod` from the repo root, or connect the
Git repository to Vercel.

## End-to-end checks

```bash
pnpm build && pnpm start -p 3100   # in one terminal
BASE=http://localhost:3100 pnpm smoke   # plays two rounds through the HTTP API
BASE=http://localhost:3100 pnpm e2e     # four headless Chrome "phones" play through the real UI
BASE=http://localhost:3100 pnpm e2e:language-voting  # language switching, saved games, and pending voters
```

`pnpm e2e` drives the system Google Chrome via puppeteer-core and writes screenshots to `.e2e-shots/`.
