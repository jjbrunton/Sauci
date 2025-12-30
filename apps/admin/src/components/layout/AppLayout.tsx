import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { Toaster } from 'sonner';

export function AppLayout() {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <header className="flex h-16 items-center border-b px-6">
                    <Breadcrumbs />
                </header>

                {/* Main content */}
                <main className="flex-1 overflow-auto p-6">
                    <Outlet />
                </main>
            </div>
            <Toaster position="top-right" richColors />
        </div>
    );
}
