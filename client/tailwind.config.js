/** @type {import('tailwindcss').Config} */
export default {
  // NOTE: js/jsx must be scanned too — the storefront components are .jsx.
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * VIANNES BISTRO — the whole storefront palette, sampled from the logo.
         *
         * There is ONE brand scale and everything reads from it. The old
         * top-level `brick`/`cream`/`charcoal` tokens are gone deliberately: two
         * parallel palettes is how the app ended up with cream-on-cream text.
         *
         * ── THE CREAM RAMP ────────────────────────────────────────────────
         * The cream family is a SINGLE HUE stepping lightness only. It used to
         * be two: the page was #F5F5D9 (hue 60°) and the card surface #ECD8B5
         * (hue 38°), and the two hues fought — which is what made the checkout
         * surfaces read muddy. Every cream below is the same hue; if you add
         * another, match it, or the clash is back.
         *
         * `paper` is the top of that ramp and exists for one reason: there is
         * NO pure white anywhere on a cream page. A #fff input on cream reads
         * as a hole punched in the page.
         *
         * ── CONTRAST — measured, not guessed. Obey these:
         *
         *   brown     on cream      7.6:1  ✅ default body text
         *   brown     on creamMid   7.0:1  ✅
         *   brown     on creamDeep  6.3:1  ✅
         *   redDeep   on cream      7.9:1  ✅ headings
         *   redDeep   on creamMid   7.3:1  ✅
         *   redDeep   on creamDeep  6.5:1  ✅
         *   cream     on redDeep    7.9:1  ✅ reversed bands
         *   ink       on cream     16.8:1  ✅ anything
         *   red       on cream      4.1:1  ⚠️  LARGE TEXT AND BUTTON FILLS ONLY
         *                                     — never body copy
         *   orange    on any cream  2.6:1  ❌ NEVER text, on any cream, ever
         *   cream     on orange     2.6:1  ❌ put ink or brown on orange instead
         *
         * ── TWO USAGE RULES THAT MATTER MORE THAN THE HEXES:
         *
         * 1. ORANGE IS ACCENT-ONLY. Cart badge, marquee separators, the
         *    sticker, small footer labels. No orange panels, no orange fills
         *    next to cream, nothing orange carrying text on a cream page.
         *
         * 2. BRIGHT `red` IS THE SINGLE PRIMARY CTA PER VIEW — Add to cart,
         *    Pay. Selected states in segmented controls and toggles use
         *    `redDeep`. Checkout once had bright red on both the Pay button
         *    and the Delivery/Pickup toggle, which is why it shouted.
         *
         * ── BORDERS are the brand brown at alpha, never a new colour:
         *
         *   decorative hairlines (card edges, dividers)  brown/20
         *   INTERACTIVE control borders (inputs, selects,
         *   segmented buttons)                           brown/65
         *
         * The 0.65 one has to clear 3:1 against its own surface for
         * non-text contrast. Do not lighten it.
         */
        brand: {
          red: '#E3231B', // logo red — wordmark, primary CTA fill
          redDeep: '#911A1C', // dark band red — navbar, statement bands, footer
          redDark: '#6E1214', // hover / pressed
          orange: '#F86F0F', // logo ribbon — badges, tickers, accents
          brown: '#733F0F', // logo outline — body text on cream, hairline borders
          brownLt: '#8A370F',
          // Single-hue ramp, lightness only. See the note above.
          cream: '#F4F3DC', // page background
          creamMid: '#ECEACB', // cards, summary panels
          creamDeep: '#E0DEB8', // section bands, photo placeholders
          creamEdge: '#D0CD9F', // heavy dividers
          paper: '#FBFAEF', // form inputs — replaces every pure #fff on cream
          ink: '#1E0E0E', // near-black
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
        // `poster` = the big retro wordmark + hero/footer display type. Titan
        //            One echoes the bubbly lettering in the logo.
        // `display` = section labels, buttons, nav, pill tags. Uppercase,
        //            tracking-wide, 600.
        // `body`    = running copy.
        //
        // Caveat is gone: the handwritten note is carried by the logo ribbon now.
        poster: ['Titan One', 'Bowlby One', 'Lilita One', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        // The marquee track is rendered twice; translating by exactly -50%
        // lands the copy on the original and the loop is seamless.
        marquee: {
          from: { transform: 'translate3d(0,0,0)' },
          to: { transform: 'translate3d(-50%,0,0)' },
        },
        spinSlow: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
        marquee: 'marquee 28s linear infinite',
        spinSlow: 'spinSlow 22s linear infinite',
      },
      borderRadius: {
        // The redesign's two signature radii: cards and the hero frame.
        card: '28px',
        hero: '32px',
      },
    },
  },
  plugins: [],
};
