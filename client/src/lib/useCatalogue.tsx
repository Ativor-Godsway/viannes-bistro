import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { Category, MenuItem } from './types';
import { FALLBACK_CATEGORIES, FALLBACK_ITEMS } from './menuData.generated';
import { imageForCategory } from '../data/menuImages';

/**
 * THE product list. One fetch, one shape, one order — for the whole storefront.
 *
 * Home and the menu page used to build their own lists from their own requests,
 * which is how they ended up disagreeing about what was for sale and for how
 * much. Both now read this array, so they cannot drift: there is only one.
 *
 * When the API is unreachable the generated offline fallback is used instead
 * (see lib/menuData.generated.ts), which is derived from the same catalogue
 * file the server seeds from — so an offline render shows the same products at
 * the same prices as an online one.
 */

export interface Product {
  _id: string;
  slug?: string;
  name: string;
  description: string;
  /** GHS. null = not priced yet: no price rendered, not purchasable. */
  basePrice: number | null;
  categoryId: string;
  categoryName: string;
  displayOrder: number;
  /** Photograph from data/menuImages.js, or null when there is none. */
  image: { file: string; alt: string } | null;
  /** Deterministic per-product seed for the placeholder shapes. */
  seed: number;
  /** The unmodified API item — what the configurator needs. */
  raw: MenuItem;
}

const categoryIdOf = (item: MenuItem): string =>
  typeof item.category === 'string' ? item.category : (item.category?._id ?? '');

/**
 * Categories + items → one flat, photo-matched, displayOrder-sorted list.
 *
 * Items whose category has no photograph are still included: the card falls
 * back to a placeholder shape. Dropping them (as the old home page did) is how
 * home and menu ended up showing different numbers of products.
 */
export function buildProducts(categories: Category[], items: MenuItem[]): Product[] {
  const byId = new Map(categories.map((c) => [c._id, c]));
  const orderOf = new Map(categories.map((c, i) => [c._id, c.displayOrder ?? i]));

  return items
    .filter((item) => item.isAvailable)
    .map((item, i) => {
      const categoryId = categoryIdOf(item);
      const category = byId.get(categoryId);
      const name = category?.name ?? (typeof item.category === 'string' ? '' : item.category?.name) ?? '';
      return {
        _id: item._id,
        slug: item.slug,
        name: item.name,
        description: item.description ?? '',
        basePrice: item.basePrice,
        categoryId,
        categoryName: name,
        displayOrder: orderOf.get(categoryId) ?? item.sortOrder ?? i,
        image: (imageForCategory(name) as { file: string; alt: string } | null) ?? null,
        seed: i + 3,
        raw: item,
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

interface CatalogueValue {
  /** Normalised, sorted, photo-matched. What the storefront renders. */
  products: Product[];
  /** The raw API items — cart revalidation and the configurator want these. */
  items: MenuItem[];
  categories: Category[];
  loading: boolean;
  error: string;
  /** True when the API could not be reached and the fallback is showing. */
  offline: boolean;
  refresh: () => void;
}

const Ctx = createContext<CatalogueValue | null>(null);

/** Session cache, so navigating between home and menu costs no request. */
let cache: { categories: Category[]; items: MenuItem[] } | null = null;

/** Drops the cache so the next mount re-fetches — admin calls this after edits. */
export function invalidateCatalogue(): void {
  cache = null;
}

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(cache?.categories ?? []);
  const [items, setItems] = useState<MenuItem[]>(cache?.items ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => {
    invalidateCatalogue();
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (cache && nonce === 0) return;
    let alive = true;
    setLoading(true);
    Promise.all([api.get<Category[]>('/categories'), api.get<MenuItem[]>('/menu')])
      .then(([cats, menu]) => {
        if (!alive) return;
        cache = { categories: cats.data, items: menu.data };
        setCategories(cats.data);
        setItems(menu.data);
        setOffline(false);
        setError('');
      })
      .catch(() => {
        if (!alive) return;
        // The storefront still renders — from the catalogue the server would
        // have served anyway, so the products and prices are the same.
        setCategories(FALLBACK_CATEGORIES);
        setItems(FALLBACK_ITEMS);
        setOffline(true);
        setError('');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [nonce]);

  const products = useMemo(() => buildProducts(categories, items), [categories, items]);

  const value = useMemo(
    () => ({ products, items, categories, loading, error, offline, refresh }),
    [products, items, categories, loading, error, offline, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalogue(): CatalogueValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalogue must be used inside <CatalogueProvider>');
  return ctx;
}
