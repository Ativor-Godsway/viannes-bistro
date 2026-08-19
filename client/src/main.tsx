import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { router } from './router';
import './index.css';

// Register GSAP ScrollTrigger once for the whole app.
gsap.registerPlugin(ScrollTrigger);
// Without this, the mobile address bar collapsing mid-scroll fires a full
// ScrollTrigger refresh and every in-flight animation visibly jumps.
ScrollTrigger.config({ ignoreMobileResize: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
