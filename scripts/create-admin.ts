/**
 * scripts/create-admin.ts
 * Creates the default admin user.
 * Run once: npx tsx scripts/create-admin.ts
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { admins } from '../lib/db/schema';
import bcrypt from 'bcryptjs';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const username = 'admin';
  const password = 'Admin@1234';

  const hash = await bcrypt.hash(password, 12);

  await db.insert(admins).values({ username, password_hash: hash }).onConflictDoNothing();

  console.log('✅ Admin created!');
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);
  console.log('   Go to: http://localhost:3000/admin/login');
}

main().catch(console.error);
