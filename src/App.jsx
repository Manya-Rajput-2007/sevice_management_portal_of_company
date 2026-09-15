import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/Layout';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import { RolePortal } from './pages/PortalPages';

function roleRedirect(role) {
  if (!role) return '/login';
  const map = {
    owner: '/owner',
    manager: '/manager',
    engineer: '/engineer',
    customer: '/customer',
  };

  return map[role] || '/login';
}

function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={roleRedirect(user.role)} replace />;
  }

  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={roleRedirect(user.role)} replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to={roleRedirect(user?.role)} replace />} />

      <Route element={<DashboardLayout />}>
        <Route path="/owner/*" element={<ProtectedRoute requiredRole="owner"><RolePortal role="owner" /></ProtectedRoute>} />
        <Route path="/manager/*" element={<ProtectedRoute requiredRole="manager"><RolePortal role="manager" /></ProtectedRoute>} />
        <Route path="/engineer/*" element={<ProtectedRoute requiredRole="engineer"><RolePortal role="engineer" /></ProtectedRoute>} />
        <Route path="/customer/*" element={<ProtectedRoute requiredRole="customer"><RolePortal role="customer" /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}
