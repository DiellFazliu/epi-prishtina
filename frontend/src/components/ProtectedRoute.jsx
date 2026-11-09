import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-epi-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-epi-cyan mx-auto"></div>
          <p className="mt-4 text-gray-400">Duke u ngarkuar...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-epi-dark">
        <div className="card max-w-md text-center">
          <h2 className="text-2xl font-bold text-epi-critical mb-4">Akses i Ndaluar</h2>
          <p className="text-gray-400">Nuk kesh të drejtë të shohësh këtë faqe.</p>
          <Link to="/admin/overview" className="inline-block mt-6 text-epi-cyan">Kthehu te Command Center</Link>
        </div>
      </div>
    );
  }

  return children;
}