import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Overview from './pages/Overview';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import Heatmaps from './pages/Heatmaps';
import Setup from './pages/Setup';
import StoreLayout from './storefront/StoreLayout';
import StoreHome from './storefront/StoreHome';
import Products from './storefront/Products';
import ProductDetail from './storefront/ProductDetail';

export default function App() {
  return (
    <ErrorBoundary>
    <Routes>
      {/* Analytics dashboard */}
      <Route path="/" element={<Layout><Overview /></Layout>} />
      <Route path="/sessions" element={<Layout><Sessions /></Layout>} />
      <Route path="/sessions/:id" element={<Layout><SessionDetail /></Layout>} />
      <Route path="/heatmaps" element={<Layout><Heatmaps /></Layout>} />
      <Route path="/setup" element={<Layout><Setup /></Layout>} />

      {/* Everyday Market demo storefront (loads the tracking script) */}
      <Route path="/store" element={<StoreLayout />}>
        <Route index element={<StoreHome />} />
        <Route path="products" element={<Products />} />
        <Route path="product/:id" element={<ProductDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  );
}
