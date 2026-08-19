import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import CustomerLayout from './components/CustomerLayout';
import Home from './pages/customer/Home';
import { MenuRedirect, CartRedirect } from './pages/customer/LegacyRedirects';
import Checkout from './pages/customer/Checkout';
import OrderTracking from './pages/customer/OrderTracking';
import Confirmation from './pages/customer/Confirmation';
import PaymentCallback from './pages/customer/PaymentCallback';

import AdminLayout from './components/admin/AdminLayout';
import AdminLogin from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Orders from './pages/admin/Orders';
import MenuManagement from './pages/admin/MenuManagement';
import ItemEditor from './pages/admin/ItemEditor';
import ModifierTemplates from './pages/admin/ModifierTemplates';
import Categories from './pages/admin/Categories';

/** Scroll restoration is mounted once, above every route, so it applies to the
 *  admin area and the storefront alike. */
function Root() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}

/** Exported separately from the router so the route table can be asserted
 *  against without a browser — see client/scripts/test-routes.mjs. */
export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      {
        element: <CustomerLayout />,
        children: [
          { path: '/', element: <Home /> },
          // The shop is one page. These two are retired routes kept alive only
          // so old links resolve — see pages/customer/LegacyRedirects.tsx.
          { path: '/menu', element: <MenuRedirect /> },
          { path: '/cart', element: <CartRedirect /> },
          { path: '/checkout', element: <Checkout /> },
          { path: '/order/:id', element: <Confirmation /> },
          { path: '/payment/callback', element: <PaymentCallback /> },
          { path: '/track/:orderId', element: <OrderTracking /> },
          { path: '/track', element: <OrderTracking /> },
        ],
      },
      { path: '/admin/login', element: <AdminLogin /> },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'orders', element: <Orders /> },
          { path: 'menu', element: <MenuManagement /> },
          { path: 'menu/new', element: <ItemEditor /> },
          { path: 'menu/:id', element: <ItemEditor /> },
          { path: 'modifiers', element: <ModifierTemplates /> },
          { path: 'categories', element: <Categories /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
