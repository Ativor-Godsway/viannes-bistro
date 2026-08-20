import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './index.css';

// No animation library is registered here, and none should be. gsap is back in
// the tree, but for exactly one thing — the hero headline's fold — and it
// registers ScrollTrigger itself, once, at module level (see ui/FoldText.tsx).
// Every other movement on the site is an IntersectionObserver plus a CSS
// transition; see lib/useReveal.ts and the motion block in index.css.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
