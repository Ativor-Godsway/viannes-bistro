import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import type { MenuItem } from '../lib/types';
import { lineKey, resolveVariant, round2, unitPrice, type Selections } from '../lib/pricing';

const STORAGE_KEY = 'viannes_cart_v1';

export interface CartLineOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDelta: number;
}

/**
 * One configured line.
 *
 * `key` is the line's identity — item id + variant + the sorted set of chosen
 * option ids. Two identical configurations collide on it and merge into one
 * line; a different crust or an extra topping is a separate line.
 */
export interface CartLine {
  key: string;
  productId: string;
  name: string;
  image: string;
  basePrice: number;
  variantId: string | null;
  variantName: string | null;
  options: CartLineOption[];
  /** basePrice + variant delta + option deltas, as last known. Display only. */
  unitPrice: number;
  quantity: number;
  specialInstructions?: string;
  /** Set by revalidation when the live menu no longer supports this line. */
  issue?: string;
}

/** What the configurator hands back. */
export interface Configuration {
  variantId?: string | null;
  selections: Selections;
  quantity: number;
  specialInstructions?: string;
}

type Action =
  | { type: 'ADD_LINE'; line: CartLine }
  | { type: 'REPLACE_LINE'; key: string; line: CartLine }
  | { type: 'REMOVE_ITEM'; key: string }
  | { type: 'SET_QUANTITY'; key: string; quantity: number }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE'; lines: CartLine[] };

function reducer(state: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case 'ADD_LINE': {
      const existing = state.find((l) => l.key === action.line.key);
      if (existing) {
        return state.map((l) =>
          l.key === action.line.key ? { ...l, quantity: l.quantity + action.line.quantity } : l
        );
      }
      return [...state, action.line];
    }
    case 'REPLACE_LINE': {
      // Editing a line can turn it into a configuration already in the cart —
      // in that case the two merge rather than sitting there as duplicates.
      const rest = state.filter((l) => l.key !== action.key);
      const collision = rest.find((l) => l.key === action.line.key);
      if (collision) {
        return rest.map((l) =>
          l.key === action.line.key ? { ...l, quantity: l.quantity + action.line.quantity } : l
        );
      }
      return state.map((l) => (l.key === action.key ? action.line : l));
    }
    case 'REMOVE_ITEM':
      return state.filter((l) => l.key !== action.key);
    case 'SET_QUANTITY':
      return action.quantity <= 0
        ? state.filter((l) => l.key !== action.key)
        : state.map((l) => (l.key === action.key ? { ...l, quantity: action.quantity } : l));
    case 'CLEAR_CART':
      return [];
    case 'HYDRATE':
      return action.lines;
    default:
      return state;
  }
}

/** A corrupted localStorage entry must never blank the storefront. */
function readStoredCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        l &&
        typeof l.key === 'string' &&
        typeof l.productId === 'string' &&
        typeof l.name === 'string' &&
        typeof l.unitPrice === 'number' &&
        Array.isArray(l.options) &&
        typeof l.quantity === 'number' &&
        l.quantity > 0
    );
  } catch {
    return [];
  }
}

/** Builds a cart line from an item plus a configuration. */
export function buildLine(
  item: MenuItem,
  config: Configuration,
  image: string
): CartLine | null {
  if (item.basePrice == null) return null;
  const variant = resolveVariant(item, config.variantId);
  const options: CartLineOption[] = (item.modifierGroups ?? []).flatMap((group) =>
    (config.selections[group.id] ?? []).flatMap((optionId) => {
      const option = group.options.find((o) => o.id === optionId);
      return option
        ? [
            {
              groupId: group.id,
              groupName: group.name,
              optionId: option.id,
              name: option.name,
              priceDelta: option.priceDelta,
            },
          ]
        : [];
    })
  );

  return {
    key: lineKey(item._id, variant?.id ?? null, config.selections),
    productId: item._id,
    name: item.name,
    image,
    basePrice: item.basePrice,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    options,
    unitPrice: unitPrice(item, config.variantId, config.selections) ?? item.basePrice,
    quantity: Math.max(1, config.quantity),
    specialInstructions: config.specialInstructions?.trim() || undefined,
  };
}

export interface PriceNotice {
  name: string;
  from: number;
  to: number;
}

interface CartValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  /** Increments on every add — the nav badge listens to this to pop. */
  addPulse: number;
  priceNotices: PriceNotice[];
  /** Lines the live menu can no longer honour, flagged by revalidation. */
  issues: CartLine[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addConfigured: (item: MenuItem, config: Configuration, image?: string) => void;
  /** Reopen-and-save from the cart: swaps one line for a new configuration. */
  replaceLine: (key: string, item: MenuItem, config: Configuration, image?: string) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  /** Total quantity of a product across every configuration of it. */
  quantityOf: (productId: string) => number;
  dismissNotices: () => void;
  /** The order payload — ids and selections only, never prices. */
  toOrderItems: () => {
    menuItemId: string;
    quantity: number;
    variantId: string | null;
    selections: { groupId: string; optionIds: string[] }[];
    specialInstructions?: string;
  }[];
}

const CartCtx = createContext<CartValue | null>(null);

/**
 * Revalidates held lines against the live menu.
 *
 * Anything whose product or option has gone away is dropped outright — it
 * cannot be ordered, so leaving it in the cart only produces a failure at
 * checkout. Anything merely re-priced is kept and repriced, with a notice.
 */
function revalidate(
  lines: CartLine[],
  menu: MenuItem[]
): { lines: CartLine[]; notices: PriceNotice[]; dropped: CartLine[] } {
  const byId = new Map(menu.map((m) => [m._id, m]));
  const notices: PriceNotice[] = [];
  const dropped: CartLine[] = [];
  const kept: CartLine[] = [];

  for (const line of lines) {
    const item = byId.get(line.productId);
    if (!item || !item.isAvailable || item.basePrice == null) {
      dropped.push({ ...line, issue: `${line.name} is no longer available` });
      continue;
    }
    if (line.variantId && !item.variants.some((v) => v.id === line.variantId)) {
      dropped.push({ ...line, issue: `${line.name} (${line.variantName}) is no longer offered` });
      continue;
    }
    const goneOption = line.options.find((o) => {
      const group = item.modifierGroups.find((g) => g.id === o.groupId);
      const option = group?.options.find((x) => x.id === o.optionId);
      return !option || !option.available;
    });
    if (goneOption) {
      dropped.push({ ...line, issue: `${goneOption.name} is sold out` });
      continue;
    }

    const selections: Selections = {};
    for (const o of line.options) (selections[o.groupId] ??= []).push(o.optionId);
    const fresh = unitPrice(item, line.variantId, selections) ?? line.unitPrice;
    if (round2(fresh) !== round2(line.unitPrice)) {
      notices.push({ name: line.name, from: line.unitPrice, to: fresh });
    }
    kept.push({ ...line, name: item.name, unitPrice: fresh, issue: undefined });
  }

  return { lines: kept, notices, dropped };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(reducer, [], readStoredCart);
  const [isOpen, setOpen] = useState(false);
  const [addPulse, setPulse] = useState(0);
  const [priceNotices, setNotices] = useState<PriceNotice[]>([]);
  const [issues, setIssues] = useState<CartLine[]>([]);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Persist on every change. Storage being unavailable (private mode, quota)
  // must not break the cart in memory.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* non-fatal */
    }
  }, [lines]);

  // Derived values live here, computed once, not in each component.
  const itemCount = useMemo(() => lines.reduce((n, l) => n + l.quantity, 0), [lines]);
  const subtotal = useMemo(
    () => round2(lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0)),
    [lines]
  );

  const addConfigured = useCallback((item: MenuItem, config: Configuration, image = '') => {
    const line = buildLine(item, config, image || item.image?.url || '');
    if (!line) return; // unpriced items are not purchasable
    dispatch({ type: 'ADD_LINE', line });
    setPulse((n) => n + 1);
  }, []);

  const replaceLine = useCallback(
    (key: string, item: MenuItem, config: Configuration, image = '') => {
      const line = buildLine(item, config, image || item.image?.url || '');
      if (!line) return;
      dispatch({ type: 'REPLACE_LINE', key, line });
    },
    []
  );

  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);

  // Revalidate against the live menu on load, and again whenever the drawer
  // opens. Client-held prices are display-only; the server re-prices every
  // order from the DB and refuses one whose subtotal disagrees.
  const check = useCallback(() => {
    if (linesRef.current.length === 0) return;
    let alive = true;
    api
      .get<MenuItem[]>('/menu')
      .then(({ data }) => {
        if (!alive) return;
        const result = revalidate(linesRef.current, data);
        if (result.dropped.length || result.notices.length) {
          dispatch({ type: 'HYDRATE', lines: result.lines });
          setNotices(result.notices);
          setIssues(result.dropped);
        }
      })
      .catch(() => {
        /* offline: keep showing the held prices, the server still re-prices */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => check(), [check]);
  useEffect(() => {
    if (isOpen) return check();
  }, [isOpen, check]);

  const value: CartValue = useMemo(
    () => ({
      lines,
      itemCount,
      subtotal,
      addPulse,
      priceNotices,
      issues,
      isOpen,
      openCart,
      closeCart,
      addConfigured,
      replaceLine,
      removeItem: (key) => dispatch({ type: 'REMOVE_ITEM', key }),
      setQuantity: (key, quantity) => dispatch({ type: 'SET_QUANTITY', key, quantity }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
      quantityOf: (productId) =>
        lines.reduce((n, l) => (l.productId === productId ? n + l.quantity : n), 0),
      dismissNotices: () => {
        setNotices([]);
        setIssues([]);
      },
      toOrderItems: () =>
        lines.map((l) => {
          const grouped = new Map<string, string[]>();
          for (const o of l.options) {
            grouped.set(o.groupId, [...(grouped.get(o.groupId) ?? []), o.optionId]);
          }
          return {
            menuItemId: l.productId,
            quantity: l.quantity,
            variantId: l.variantId,
            selections: [...grouped].map(([groupId, optionIds]) => ({ groupId, optionIds })),
            specialInstructions: l.specialInstructions,
          };
        }),
    }),
    [
      lines,
      itemCount,
      subtotal,
      addPulse,
      priceNotices,
      issues,
      isOpen,
      openCart,
      closeCart,
      addConfigured,
      replaceLine,
    ]
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
