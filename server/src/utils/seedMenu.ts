/**
 * DESTRUCTIVE catalogue reset.
 *
 *   npm --prefix server run seed:menu:reset
 *
 * This wipes the catalogue back to exactly what `data/catalogue.ts` describes:
 * categories, items and templates NOT in the catalogue are DELETED, taking
 * their _ids with them and orphaning any order that referenced them.
 *
 * You almost never want this. The normal path is the boot-time upsert in
 * utils/syncCatalogue.ts, which never deletes. This exists for wiping a local
 * database back to a known state.
 *
 * Two guards, because the default MONGO_URI in this repo points at a shared
 * Atlas cluster:
 *   · it refuses to run unless MONGO_URI is a localhost address, and
 *   · `--force` is required to override that refusal.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Category } from '../models/Category';
import { MenuItem } from '../models/MenuItem';
import { ModifierGroupTemplate } from '../models/ModifierGroupTemplate';
import { CATALOGUE, TEMPLATES } from '../data/catalogue';
import { syncCatalogue, categorySlugOf } from './syncCatalogue';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/besties';

/** True only for an unmistakably local database. */
export function isLocalDatabase(uri: string): boolean {
  return /^mongodb:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(uri);
}

export async function resetMenu(): Promise<void> {
  await syncCatalogue();

  const keepItemSlugs = CATALOGUE.map((c) => c.slug);
  const keepCategorySlugs = CATALOGUE.map((c) => categorySlugOf(c.category));
  const keepTemplateNames = TEMPLATES.map((t) => t.name);

  const items = await MenuItem.deleteMany({ slug: { $nin: keepItemSlugs } });
  const cats = await Category.deleteMany({ slug: { $nin: keepCategorySlugs } });
  const templates = await ModifierGroupTemplate.deleteMany({ name: { $nin: keepTemplateNames } });

  console.log(
    `🧨 Catalogue reset: kept ${CATALOGUE.length} items / ${keepCategorySlugs.length} categories; ` +
      `deleted ${items.deletedCount} item(s), ${cats.deletedCount} categor(y|ies), ` +
      `${templates.deletedCount} template(s).`
  );
}

if (require.main === module) {
  (async () => {
    const force = process.argv.includes('--force');
    if (!isLocalDatabase(MONGO_URI) && !force) {
      console.error(
        '✋ Refusing to run a destructive reset against a non-local database.\n' +
          `   MONGO_URI = ${MONGO_URI.replace(/\/\/[^@]*@/, '//***@')}\n\n` +
          '   This DELETES catalogue rows and orphans order history. If you are\n' +
          '   certain, re-run with --force. The safe path is just restarting the\n' +
          '   server, which upserts the catalogue without deleting anything.'
      );
      process.exit(1);
    }
    await connectDB(MONGO_URI);
    await resetMenu();
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
