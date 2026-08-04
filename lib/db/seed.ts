/**
 * lib/db/seed.ts
 *
 * Seeds the database with default data:
 *  - 5 stages with puzzle/hint/word-fragment/access-code/difficulty values
 *  - registration_qr singleton row (id=1, qr_url="/register")
 *  - event_config singleton row (id=1, start_time=null, end_time=null)
 *
 * Run with:
 *   npx tsx lib/db/seed.ts
 *
 * Requires DATABASE_URL to be set in the environment (or .env.local).
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { stages, registrationQr, eventConfig } from './schema';

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log('🌱 Seeding stages...');

  await db
    .insert(stages)
    .values([
      {
        stage_number: 1,
        difficulty: 'Medium',
        puzzle_text: 'Decode the binary: `01001100 01000001 01000010`',
        hint_text: 'Jahan computers kabhi sote nahi.',
        word_fragment: 'WI',
        access_code: 'STAGE1',
        qr_url: '/stage/1',
      },
      {
        stage_number: 2,
        difficulty: 'Medium-Hard',
        puzzle_text: 'ɹɐɹqᴉ˥ — Mirror ya phone ulta karke dekho.',
        hint_text: '(Library hint)',
        word_fragment: 'N',
        access_code: 'STAGE2',
        qr_url: '/stage/2',
      },
      {
        stage_number: 3,
        difficulty: 'Hard',
        puzzle_text:
          'Password has 8 characters. Starts with C. Ends with R. Contains 2026. (Computer or Technical Related)',
        hint_text: '(hint)',
        word_fragment: 'N',
        access_code: 'STAGE3',
        qr_url: '/stage/3',
      },
      {
        stage_number: 4,
        difficulty: 'Very Hard',
        puzzle_text: "Decode using Caesar Cipher (+3 shift): `FRPSXWHU ODE`",
        hint_text: '(hint)',
        word_fragment: 'ER',
        access_code: 'STAGE4',
        qr_url: '/stage/4',
      },
      {
        stage_number: 5,
        difficulty: 'Final Boss 🏆',
        puzzle_text:
          'You have collected word fragments from each previous QR. Arrange them in the order you visited and enter the combined code. (Remember: you were shown a word at each stage!)',
        hint_text: null,
        word_fragment: null,
        access_code: 'WINNER',
        qr_url: '/stage/5',
      },
    ])
    .onConflictDoNothing();

  console.log('🌱 Seeding registration_qr...');

  await db
    .insert(registrationQr)
    .values({
      id: 1,
      qr_url: '/register',
    })
    .onConflictDoNothing();

  console.log('🌱 Seeding event_config...');

  await db
    .insert(eventConfig)
    .values({
      id: 1,
      start_time: null,
      end_time: null,
    })
    .onConflictDoNothing();

  console.log('✅ Seed complete.');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
