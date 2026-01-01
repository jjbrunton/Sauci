import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { Toaster } from 'sonner';
import { Button } from '@/components/ui/button';

export function AppLayout() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Subtle gradient overlay */}
            <div className="fixed inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent pointer-events-none" />

            <Sidebar
                mobileOpen={mobileMenuOpen}
                onMobileClose={() => setMobileMenuOpen(false)}
            />
            <div className="flex flex-1 flex-col overflow-hidden relative">
                {/* Header */}
                <header className="flex h-14 xl:h-16 items-center gap-3 border-b border-white/5 px-4 xl:px-8 bg-card/50 backdrop-blur-sm">
                    {/* Mobile menu button - visible below xl breakpoint */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="xl:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={() => setMobileMenuOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                    <Breadcrumbs />
                </header>

                {/* Main content */}
                <main className="flex-1 overflow-auto p-4 xl:p-8">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: 'hsl(240 8% 10%)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'hsl(30 20% 95%)',
                    },
                }}
            />
        </div>
    );
}
