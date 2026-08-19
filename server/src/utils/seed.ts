/**
 * DESTRUCTIVE development seed.
 *
 *   npm --prefix server run seed
 *
 * This DELETES every User, Category and MenuItem before recreating them. Run
 * against production and you destroy the customer accounts, the catalogue and
 * every order's ability to resolve the item it referenced.
 *
 * Three guards, because the repo's own .env points at a shared Atlas cluster:
 *
 *   1. It refuses to run unless MONGO_URI is unmistakably local, or --force is
 *      passed explicitly.
 *   2. The admin password comes from SEED_ADMIN_PASSWORD with NO default. The
 *      old hardcoded `Admin123!` was a published backdoor into any deployment
 *      that had ever been seeded.
 *   3. The demo customer is only created outside production.
 *
 * For the normal case — getting the catalogue into a database — you want the
 * non-destructive boot-time sync instead (utils/syncCatalogue.ts). It upserts
 * and never deletes.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User, hashPassword } from '../models/User';
import { Category } from '../models/Category';
import { MenuItem } from '../models/MenuItem';
import { syncCatalogue } from './syncCatalogue';
import { isLocalDatabase } from './seedMenu';

const MONGO_URI = process.env.MONGO_URI || '';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@besties.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Redacts credentials so a refusal message can be pasted into an issue. */
const safeUri = (uri: string) => uri.replace(/\/\/[^@]*@/, '//***:***@');

function refuse(message: string): never {
  console.error(`\n✋ ${message}\n`);
  process.exit(1);
}

async function seed() {
  const force = process.argv.includes('--force');

  if (!MONGO_URI) refuse('MONGO_URI is not set. Refusing to guess a database.');

  if (!isLocalDatabase(MONGO_URI) && !force) {
    refuse(
      'Refusing to run a DESTRUCTIVE seed against a non-local database.\n' +
        `   MONGO_URI = ${safeUri(MONGO_URI)}\n\n` +
        '   This deletes every user, category and menu item.\n' +
        '   If you are certain, re-run with --force.\n' +
        '   To load the catalogue without deleting anything, just start the\n' +
        '   server — it upserts on boot (SYNC_CATALOGUE_ON_BOOT).'
    );
  }

  if (!ADMIN_PASSWORD) {
    refuse(
      'SEED_ADMIN_PASSWORD is not set, and there is no default.\n\n' +
        '   Set a strong one for this run, e.g.\n' +
        '     SEED_ADMIN_PASSWORD="$(openssl rand -base64 24)" npm run seed\n' +
        '   …and record it somewhere safe before you lose the terminal.'
    );
  }
  if (ADMIN_PASSWORD.length < 12) {
    refuse('SEED_ADMIN_PASSWORD must be at least 12 characters.');
  }

  await connectDB(MONGO_URI);

  console.log(`🌱 Clearing existing data in ${safeUri(MONGO_URI)} …`);
  await Promise.all([User.deleteMany({}), Category.deleteMany({}), MenuItem.deleteMany({})]);

  console.log('👤 Creating the admin account…');
  await User.create({
    name: 'Besties Admin',
    email: ADMIN_EMAIL,
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    role: 'admin',
    phone: '0200000000',
  });

  // A demo login with a known password is a backdoor anywhere real.
  if (!IS_PRODUCTION) {
    const demoPassword = process.env.SEED_DEMO_PASSWORD || ADMIN_PASSWORD;
    await User.create({
      name: 'Demo Customer',
      email: 'demo@besties.com',
      passwordHash: await hashPassword(demoPassword),
      role: 'customer',
      phone: '0244123456',
    });
    console.log('👤 Added the demo customer (development only).');
  }

  console.log('📂 Syncing the catalogue…');
  await syncCatalogue();

  console.log(`\n✅ Seeded. Admin: ${ADMIN_EMAIL} (password as supplied).\n`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
