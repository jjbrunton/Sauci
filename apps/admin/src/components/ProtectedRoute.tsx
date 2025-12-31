import { Navigate } from 'react-router-dom';
import { useAuth, PermissionKey } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireSuperAdmin?: boolean;
    requiredPermission?: PermissionKey;
}

export function ProtectedRoute({ children, requireSuperAdmin = false, requiredPermission }: ProtectedRouteProps) {
    const { session, loading, isSuperAdmin, hasPermission } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    if (requireSuperAdmin && !isSuperAdmin) {
        return <Navigate to="/" replace />;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
