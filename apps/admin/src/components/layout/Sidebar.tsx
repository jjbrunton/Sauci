import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth, PERMISSION_KEYS, PermissionKey } from '@/contexts/AuthContext';
import {
    LayoutGrid,
    Users,
    ClipboardList,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Shield,
    Ticket,
    MessageSquareText,
    Target,
    Bot,
    Smartphone,
    X,
    Home,
    Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import logoImage from '@/assets/logo.png';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    requiredPermission?: PermissionKey;
}

const dashboardNav: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/',
        icon: <Home className="h-5 w-5" />,
    },
];

const contentNav: NavItem[] = [
    {
        label: 'Categories',
        href: '/categories',
        icon: <LayoutGrid className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.MANAGE_CATEGORIES,
    },
];

const usersNav: NavItem[] = [
    {
        label: 'Users',
        href: '/users',
        icon: <Users className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.VIEW_USERS,
    },
    {
        label: 'User Activity',
        href: '/activity',
        icon: <Activity className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.VIEW_ACTIVITY,
    },
    {
        label: 'Usage Insights',
        href: '/usage-insights',
        icon: <Target className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.VIEW_USERS,
    },
    {
        label: 'Feedback',
        href: '/feedback',
        icon: <MessageSquareText className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.MANAGE_FEEDBACK,
    },
];

const systemNav: NavItem[] = [
    {
        label: 'Admins',
        href: '/admins',
        icon: <Shield className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.MANAGE_ADMINS,
    },
    {
        label: 'AI Settings',
        href: '/ai-settings',
        icon: <Bot className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.MANAGE_AI_CONFIG,
    },
    {
        label: 'App Settings',
        href: '/app-settings',
        icon: <Smartphone className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.MANAGE_APP_CONFIG,
    },
    {
        label: 'Redemption Codes',
        href: '/redemption-codes',
        icon: <Ticket className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.MANAGE_CODES,
    },
    {
        label: 'Audit Logs',
        href: '/audit-logs',
        icon: <ClipboardList className="h-5 w-5" />,
        requiredPermission: PERMISSION_KEYS.VIEW_AUDIT_LOGS,
    },
];

interface SidebarProps {
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
    const location = useLocation();
    const { user, permissions, logout, hasPermission } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    // Close mobile sidebar on route change
    useEffect(() => {
        if (mobileOpen && onMobileClose) {
            onMobileClose();
        }
    }, [location.pathname]);

    const NavLink = ({ item }: { item: NavItem }) => {
        if (item.requiredPermission && !hasPermission(item.requiredPermission)) return null;

        const isActive = item.href === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.href);

        return (
            <Link
                to={item.href}
                className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                        ? "bg-gradient-rose text-white shadow-lg glow-rose-sm"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    collapsed && "justify-center px-2 lg:justify-center lg:px-2"
                )}
            >
                <span className={cn(
                    "transition-transform duration-200",
                    !isActive && "group-hover:scale-110"
                )}>
                    {item.icon}
                </span>
                {!collapsed && <span>{item.label}</span>}
            </Link>
        );
    };

    const NavSection = ({ title, items }: { title: string; items: NavItem[] }) => {
        const visibleItems = items.filter(item => !item.requiredPermission || hasPermission(item.requiredPermission));
        if (visibleItems.length === 0) return null;

        return (
            <div className="space-y-1">
                {!collapsed && (
                    <h4 className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {title}
                    </h4>
                )}
                {visibleItems.map(item => (
                    <NavLink key={item.href} item={item} />
                ))}
            </div>
        );
    };

    const sidebarContent = (
        <div
            className={cn(
                "flex h-screen flex-col border-r border-white/5 bg-gradient-to-b from-card to-background transition-all duration-300",
                // Desktop only: hidden on mobile/tablet, show on desktop
                "hidden xl:flex",
                collapsed ? "xl:w-20" : "xl:w-72"
            )}
        >
            {/* Logo */}
            <div className="flex h-20 items-center justify-between px-4 border-b border-white/5">
                {!collapsed && (
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="relative">
                            <img
                                src={logoImage}
                                alt="Sauci"
                                className="h-10 w-10 object-contain transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-rose opacity-0 group-hover:opacity-20 rounded-full blur-xl transition-opacity duration-300" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-bold tracking-tight text-gradient-sunset">
                                Sauci
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                Admin Portal
                            </span>
                        </div>
                    </Link>
                )}
                {collapsed && (
                    <Link to="/" className="mx-auto">
                        <img
                            src={logoImage}
                            alt="Sauci"
                            className="h-10 w-10 object-contain"
                        />
                    </Link>
                )}
            </div>

            {/* Collapse button */}
            <div className="flex justify-end px-2 py-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Navigation */}
            <div className="flex-1 space-y-6 overflow-auto px-3 py-2">
                <NavSection title="Dashboard" items={dashboardNav} />
                <NavSection title="Content" items={contentNav} />
                <NavSection title="Users" items={usersNav} />
                <NavSection title="System" items={systemNav} />
            </div>

            <Separator className="bg-white/5" />

            {/* User info */}
            <div className={cn("p-4", collapsed && "flex flex-col items-center")}>
                <div className={cn(
                    "flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5",
                    collapsed && "flex-col p-2"
                )}>
                    <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                        <AvatarFallback className="bg-gradient-rose text-white font-semibold">
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </AvatarFallback>
                    </Avatar>
                    {!collapsed && (
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-sm font-medium text-foreground">
                                {user?.email}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                                {permissions?.role?.replace('_', ' ')}
                            </p>
                        </div>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size={collapsed ? "icon" : "sm"}
                    className={cn(
                        "mt-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                        collapsed ? "w-9 h-9" : "w-full justify-start"
                    )}
                    onClick={logout}
                >
                    <LogOut className="h-4 w-4" />
                    {!collapsed && <span className="ml-2">Sign Out</span>}
                </Button>
            </div>
        </div>
    );

    // Mobile sidebar (overlay)
    const mobileSidebar = (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity xl:hidden",
                    mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onMobileClose}
            />

            {/* Slide-in sidebar */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out xl:hidden",
                    mobileOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex h-full flex-col border-r border-white/5 bg-gradient-to-b from-card to-background">
                    {/* Mobile header with close button */}
                    <div className="flex h-20 items-center justify-between px-4 border-b border-white/5">
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="relative">
                                <img
                                    src={logoImage}
                                    alt="Sauci"
                                    className="h-10 w-10 object-contain"
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold tracking-tight text-gradient-sunset">
                                    Sauci
                                </span>
                                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Admin Portal
                                </span>
                            </div>
                        </Link>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onMobileClose}
                            className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Navigation */}
                    <div className="flex-1 space-y-6 overflow-auto px-3 py-4">
                        <NavSection title="Dashboard" items={dashboardNav} />
                        <NavSection title="Content" items={contentNav} />
                        <NavSection title="Users" items={usersNav} />
                        <NavSection title="System" items={systemNav} />
                    </div>

                    <Separator className="bg-white/5" />

                    {/* User info */}
                    <div className="p-4">
                        <div className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5">
                            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                                <AvatarFallback className="bg-gradient-rose text-white font-semibold">
                                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden">
                                <p className="truncate text-sm font-medium text-foreground">
                                    {user?.email}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                    {permissions?.role?.replace('_', ' ')}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={logout}
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="ml-2">Sign Out</span>
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <>
            {sidebarContent}
            {mobileSidebar}
        </>
    );
}
