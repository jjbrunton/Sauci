import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { Toaster } from 'sonner';

export function AppLayout() {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Subtle gradient overlay */}
            <div className="fixed inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent pointer-events-none" />

            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden relative">
                {/* Header */}
                <header className="flex h-16 items-center border-b border-white/5 px-8 bg-card/50 backdrop-blur-sm">
                    <Breadcrumbs />
                </header>

                {/* Main content */}
                <main className="flex-1 overflow-auto p-8">
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
