import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useCart } from '../../store/CartContext';

/**
 * The storefront used to have a standalone /menu page and a /cart route. Both
 * are gone — the menu is a section of the homepage and the cart is a drawer
 * over it. These keep old links, bookmarks and shared URLs landing somewhere
 * sensible instead of on a 404.
 */

/** /menu → the homepage, scrolled to the menu. Home reads the hash. */
export function MenuRedirect() {
  return <Navigate to="/#menu" replace />;
}

/** /cart → the homepage with the cart drawer already open. */
export function CartRedirect() {
  const { openCart } = useCart();
  useEffect(() => {
    openCart();
  }, [openCart]);
  return <Navigate to="/" replace />;
}
