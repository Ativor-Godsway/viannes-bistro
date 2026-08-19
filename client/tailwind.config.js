/** @type {import('tailwindcss').Config} */
export default {
  // NOTE: js/jsx must be scanned too — the storefront components are .jsx.
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Poster palette (storefront). Cream-on-brick and brick-on-cream only.
        brick: '#C2261C',
        redDeep: '#9E1B13',
        cream: '#EBD9BC',
        creamLt: '#F7EFE2',
        charcoal: '#1A1A1A',
        gold: '#E0A72C',
        // Legacy tokens still used by /menu, /cart, /checkout and admin,
        // re-pointed at the poster palette so the app stays coherent.
        brand: {
          red: '#C2261C',
          redDark: '#9E1B13',
          gold: '#E0A72C',
          cream: '#F7EFE2',
          charcoal: '#1A1A1A',
        },
        success: '#1DB954',
        // Admin surface palette. Deliberately neutral: the admin is a tool, so
        // the brand red appears only as an accent (primary, active, danger).
        admin: {
          bg: '#F5F6F8',
          surface: '#FFFFFF',
          line: '#E7E9EE',
          ink: '#12141A',
          muted: '#6B7280',
          subtle: '#9AA1AD',
          sidebar: '#FFFFFF',
        },
      },
      /**
       * THE stacking order for everything that floats above the page.
       *
       * Ad-hoc `z-[80]` / `z-[100]` values are how the configurator ended up
       * *underneath* the cart drawer's full-screen overlay — visible, dimmed
       * and completely inert. Anything `fixed` uses a name from this list and
       * nothing else, so the order is readable in one place.
       *
       * Bottom → top. The hero's internal layers are not here: it sets
       * `isolate`, so its z-values form their own stacking context and never
       * compete with these.
       */
      zIndex: {
        'admin-link': '30',
        'cart-bar': '40',
        nav: '50',
        toast: '60',
        drawer: '70',
        // Always above the drawer: editing a cart line opens this over it.
        configurator: '80',
      },
      boxShadow: {
        // Soft and low-opacity: admin cards are separated by elevation, not by
        // borders. Anything heavier reads as a consumer app.
        card: '0 1px 2px rgba(18,20,26,0.04), 0 8px 24px rgba(18,20,26,0.05)',
        cardHover: '0 1px 2px rgba(18,20,26,0.05), 0 12px 32px rgba(18,20,26,0.08)',
      },
      fontFamily: {
        // `poster` = condensed black display face (hero headline + category labels).
        // `script`  = handwriting overlay.
        // `display` stays Poppins so this rebuild is scoped to the storefront.
        poster: ['Anton', 'Arial Narrow', 'system-ui', 'sans-serif'],
        script: ['Caveat', 'Bradley Hand', 'cursive'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
