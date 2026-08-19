import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Route-change scroll restoration.
 *
 * A PUSH or REPLACE lands at the top of the new page; a POP — browser back and
 * forward — is left alone so the browser's own restoration can put the user
 * back where they were. `behavior: 'instant'` rather than smooth: a page that
 * animates its way to the top on every navigation reads as lag.
 *
 * The window is not the only scroller. The two-column menu page scrolls its
 * grid in a nested container, so anything marked `data-scroll-reset` is reset
 * too — otherwise you arrive at a fresh route already halfway down the list.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document
      .querySelectorAll<HTMLElement>('[data-scroll-reset]')
      .forEach((el) => el.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior }));
  }, [pathname, navigationType]);

  return null;
}
