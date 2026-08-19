import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './index.css';

// No animation library is registered here. The redesign removed every
// scroll-linked animation, and PlaceholderShape's idle loop is now CSS
// keyframes — so gsap is gone from the dependency tree entirely.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
