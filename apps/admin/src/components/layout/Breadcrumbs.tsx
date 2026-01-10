import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { supabase } from '@/config';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface PackInfo {
    category_id: string | null;
    category_name: string | null;
}

interface UserInfo {
    id: string;
    name: string | null;
}

// Generate breadcrumbs based on current path and params
function useBreadcrumbs(): { breadcrumbs: BreadcrumbItem[]; loading: boolean } {
    const location = useLocation();
    const params = useParams();
    const [packInfo, setPackInfo] = useState<PackInfo | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(false);

    // Fetch pack info when on questions page to get category_id
    useEffect(() => {
        const fetchPackInfo = async () => {
            if (params.packId && !params.categoryId) {
                setLoading(true);
                try {
                    const { data } = await supabase
                        .from('question_packs')
                        .select('category_id, categories(name)')
                        .eq('id', params.packId)
                        .single();

                    if (data) {
                        setPackInfo({
                            category_id: data.category_id,
                            category_name: (data.categories as any)?.name || null,
                        });
                    }
                } catch (error) {
                    console.error('Failed to fetch pack info for breadcrumbs:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setPackInfo(null);
            }
        };

        fetchPackInfo();
    }, [params.packId, params.categoryId]);

    // Fetch user info when on user detail or match chat page
    useEffect(() => {
        const fetchUserInfo = async () => {
            if (params.userId) {
                setLoading(true);
                try {
                    const { data } = await supabase
                        .from('profiles')
                        .select('id, name')
                        .eq('id', params.userId)
                        .single();

                    if (data) {
                        setUserInfo({
                            id: data.id,
                            name: data.name,
                        });
                    }
                } catch (error) {
                    console.error('Failed to fetch user info for breadcrumbs:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setUserInfo(null);
            }
        };

        fetchUserInfo();
    }, [params.userId]);

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
        } else if (segment === 'packs' && params.packId && packInfo?.category_id) {
            // On questions page, link back to category's packs
            breadcrumbs.push({ label: 'Categories', href: '/categories' });
            breadcrumbs.push({
                label: packInfo.category_name || 'Packs',
                href: `/categories/${packInfo.category_id}/packs`
            });
        } else if (segment === 'questions' && params.packId) {
            breadcrumbs.push({ label: 'Questions', href: currentPath });
        } else if (segment === 'tags') {
            breadcrumbs.push({ label: 'Tags', href: '/tags' });
        } else if (segment === 'users') {
            breadcrumbs.push({ label: 'Users', href: '/users' });
            // If we have a userId, add the user's name as a breadcrumb
            if (params.userId && userInfo) {
                breadcrumbs.push({
                    label: userInfo.name || 'User',
                    href: `/users/${userInfo.id}`,
                });
            }
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

    return { breadcrumbs, loading };
}

export function Breadcrumbs() {
    const { breadcrumbs, loading } = useBreadcrumbs();

    if (breadcrumbs.length === 0 && !loading) return null;

    return (
        <nav className="flex items-center space-x-1 text-sm">
            <Link
                to="/"
                className="flex items-center text-muted-foreground hover:text-primary transition-colors p-1 rounded-md hover:bg-white/5"
            >
                <Home className="h-4 w-4" />
            </Link>

            {breadcrumbs.map((item, index) => (
                <div key={index} className="flex items-center">
                    <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
                    {item.href ? (
                        <Link
                            to={item.href}
                            className="text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-foreground font-medium px-2 py-1">
                            {item.label}
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
}
