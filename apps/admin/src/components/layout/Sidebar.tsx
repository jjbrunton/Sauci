import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutGrid,
    Users,
    ClipboardList,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Sparkles,
    Shield,
    Ticket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    requireSuperAdmin?: boolean;
}

const contentNav: NavItem[] = [
    {
        label: 'Categories',
        href: '/categories',
        icon: <LayoutGrid className="h-5 w-5" />,
    },
];

const usersNav: NavItem[] = [
    {
        label: 'Users',
        href: '/users',
        icon: <Users className="h-5 w-5" />,
        requireSuperAdmin: true,
    },
];

const systemNav: NavItem[] = [
    {
        label: 'Admins',
        href: '/admins',
        icon: <Shield className="h-5 w-5" />,
        requireSuperAdmin: true,
    },
    {
        label: 'Redemption Codes',
        href: '/redemption-codes',
        icon: <Ticket className="h-5 w-5" />,
        requireSuperAdmin: true,
    },
    {
        label: 'Audit Logs',
        href: '/audit-logs',
        icon: <ClipboardList className="h-5 w-5" />,
        requireSuperAdmin: true,
    },
];

export function Sidebar() {
    const location = useLocation();
    const { user, permissions, logout, isSuperAdmin } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    const NavLink = ({ item }: { item: NavItem }) => {
        if (item.requireSuperAdmin && !isSuperAdmin) return null;

        const isActive = location.pathname.startsWith(item.href);

        return (
            <Link
                to={item.href}
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    collapsed && "justify-center px-2"
                )}
            >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
            </Link>
        );
    };

    const NavSection = ({ title, items }: { title: string; items: NavItem[] }) => {
        const visibleItems = items.filter(item => !item.requireSuperAdmin || isSuperAdmin);
        if (visibleItems.length === 0) return null;

        return (
            <div className="space-y-1">
                {!collapsed && (
                    <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {title}
                    </h4>
                )}
                {visibleItems.map(item => (
                    <NavLink key={item.href} item={item} />
                ))}
            </div>
        );
    };

    return (
        <div
            className={cn(
                "flex h-screen flex-col border-r bg-card transition-all duration-300",
                collapsed ? "w-16" : "w-64"
            )}
        >
            {/* Logo */}
            <div className="flex h-16 items-center justify-between border-b px-4">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="text-lg font-bold">Sauci Admin</span>
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(collapsed && "mx-auto")}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Navigation */}
            <div className="flex-1 space-y-6 overflow-auto p-4">
                <NavSection title="Content" items={contentNav} />
                <NavSection title="Users" items={usersNav} />
                <NavSection title="System" items={systemNav} />
            </div>

            <Separator />

            {/* User info */}
            <div className={cn("p-4", collapsed && "flex flex-col items-center")}>
                <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </AvatarFallback>
                    </Avatar>
                    {!collapsed && (
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-sm font-medium">{user?.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                                {permissions?.role?.replace('_', ' ')}
                            </p>
                        </div>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size={collapsed ? "icon" : "sm"}
                    className={cn("mt-3", collapsed ? "w-8 h-8" : "w-full")}
                    onClick={logout}
                >
                    <LogOut className="h-4 w-4" />
                    {!collapsed && <span className="ml-2">Logout</span>}
                </Button>
            </div>
        </div>
    );
}
