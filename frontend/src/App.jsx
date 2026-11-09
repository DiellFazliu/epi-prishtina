import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { WebSocketProvider } from './hooks/WebSocketContext.jsx';
import AdminLayout from './components/AdminLayout';
import CitizenLayout from './components/CitizenLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
// Admin pages
import MapPage from './pages/admin/MapPage';
import SimulationHubPage from './pages/admin/SimulationHubPage';
import OperationsHubPage from './pages/admin/OperationsHubPage';
import IntelligenceHubPage from './pages/admin/IntelligenceHubPage';

// Portal pages
import PortalHome from './pages/portal/PortalHome';
import PortalHistory from './pages/portal/PortalHistory';
import PortalProfile from './pages/portal/PortalProfile';
import CitizenReport from './pages/CitizenReport';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ═══ ADMIN ZONE ═══ */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin', 'health_worker', 'analyst']}>
              <AdminLayout><Dashboard /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/overview" element={
            <ProtectedRoute allowedRoles={['admin', 'health_worker', 'analyst']}>
              <AdminLayout><Dashboard /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/simulation" element={
            <ProtectedRoute allowedRoles={['admin', 'health_worker', 'analyst']}>
              <AdminLayout><SimulationHubPage /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/operations" element={
            <ProtectedRoute allowedRoles={['admin', 'health_worker', 'analyst']}>
              <AdminLayout><OperationsHubPage /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/intelligence" element={
            <ProtectedRoute allowedRoles={['admin', 'health_worker', 'analyst']}>
              <AdminLayout><IntelligenceHubPage /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/map" element={
            <ProtectedRoute allowedRoles={['admin', 'health_worker', 'analyst']}>
              <AdminLayout><MapPage /></AdminLayout>
            </ProtectedRoute>
          } />
          {/* Legacy deep links now resolve into the five operational hubs. */}
          <Route path="/admin/pipeline" element={<Navigate to="/admin/simulation?tab=pipeline" replace />} />
          <Route path="/admin/strategy" element={<Navigate to="/admin/simulation?tab=strategy" replace />} />
          <Route path="/admin/analytics" element={<Navigate to="/admin/intelligence?tab=analytics" replace />} />
          <Route path="/admin/predictions" element={<Navigate to="/admin/intelligence?tab=predictions" replace />} />
          <Route path="/admin/rl-emergency" element={<Navigate to="/admin/intelligence?tab=rl" replace />} />
          <Route path="/admin/reports" element={<Navigate to="/admin/operations?tab=reports" replace />} />
          <Route path="/admin/resources" element={<Navigate to="/admin/operations?tab=resources" replace />} />
          <Route path="/admin/routing" element={<Navigate to="/admin/operations?tab=routing" replace />} />
          <Route path="/admin/users" element={<Navigate to="/admin/overview" replace />} />
          <Route path="/admin/settings" element={<Navigate to="/admin/overview" replace />} />

          {/* ═══ CITIZEN PORTAL ═══ */}
          <Route path="/portal" element={
            <ProtectedRoute><CitizenLayout><PortalHome /></CitizenLayout></ProtectedRoute>
          } />
          <Route path="/portal/report" element={
            <ProtectedRoute><CitizenLayout><CitizenReport /></CitizenLayout></ProtectedRoute>
          } />
          <Route path="/portal/history" element={
            <ProtectedRoute><CitizenLayout><PortalHistory /></CitizenLayout></ProtectedRoute>
          } />
          <Route path="/portal/profile" element={
            <ProtectedRoute><CitizenLayout><PortalProfile /></CitizenLayout></ProtectedRoute>
          } />

          {/* Default */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}