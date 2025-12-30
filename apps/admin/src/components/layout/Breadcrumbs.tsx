import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

// Generate breadcrumbs based on current path and params
function useBreadcrumbs(): BreadcrumbItem[] {
    const location = useLocation();
    const params = useParams();

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    let currentPath = '';
    for (const segment of pathSegments) {
        currentPath += `/${segment}`;

        // Map segments to readable labels
        if (segment === 'categories') {
            breadcrumbs.push({ label: 'Categories', href: '/categories' });
        } else if (segment === 'packs' && params.categoryId) {
            breadcrumbs.push({ label: 'Packs', href: currentPath });
        } else if (segment === 'questions' && params.packId) {
            breadcrumbs.push({ label: 'Questions', href: currentPath });
        } else if (segment === 'users') {
            breadcrumbs.push({ label: 'Users', href: '/users' });
        } else if (segment === 'matches' && params.userId) {
            breadcrumbs.push({ label: 'Match Chat' });
        } else if (segment === 'audit-logs') {
            breadcrumbs.push({ label: 'Audit Logs', href: '/audit-logs' });
        } else if (segment === 'new') {
            breadcrumbs.push({ label: 'Create New' });
        } else if (segment === 'edit') {
            breadcrumbs.push({ label: 'Edit' });
        }
        // Skip UUID segments as they're handled with their parent
    }

    // Remove href from last item (current page)
    if (breadcrumbs.length > 0) {
        breadcrumbs[breadcrumbs.length - 1].href = undefined;
    }

    return breadcrumbs;
}

export function Breadcrumbs() {
    const breadcrumbs = useBreadcrumbs();

    if (breadcrumbs.length === 0) return null;

    return (
        <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Link
                to="/"
                className="flex items-center hover:text-foreground transition-colors"
            >
                <Home className="h-4 w-4" />
            </Link>

            {breadcrumbs.map((item, index) => (
                <div key={index} className="flex items-center">
                    <ChevronRight className="h-4 w-4 mx-1" />
                    {item.href ? (
                        <Link
                            to={item.href}
                            className="hover:text-foreground transition-colors"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-foreground font-medium">{item.label}</span>
                    )}
                </div>
            ))}
        </nav>
    );
}
