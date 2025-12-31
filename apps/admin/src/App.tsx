import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CategoriesPage } from '@/pages/content/CategoriesPage';
import { PacksPage } from '@/pages/content/PacksPage';
import { QuestionsPage } from '@/pages/content/QuestionsPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { UserDetailPage } from '@/pages/users/UserDetailPage';
import { MatchChatPage } from '@/pages/users/MatchChatPage';
import { AuditLogsPage } from '@/pages/AuditLogsPage';
import { AdminsPage } from '@/pages/admins/AdminsPage';
import { RedemptionCodesPage } from '@/pages/RedemptionCodesPage';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Protected routes */}
                    <Route
                        element={
                            <ProtectedRoute>
                                <AppLayout />
                            </ProtectedRoute>
                        }
                    >
                        {/* Dashboard */}
                        <Route path="/" element={<DashboardPage />} />

                        {/* Content management */}
                        <Route path="/categories" element={<CategoriesPage />} />
                        <Route path="/categories/:categoryId/packs" element={<PacksPage />} />
                        <Route path="/packs/:packId/questions" element={<QuestionsPage />} />

                        {/* User management (super_admin only) */}
                        <Route
                            path="/users"
                            element={
                                <ProtectedRoute requireSuperAdmin>
                                    <UsersPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/users/:userId"
                            element={
                                <ProtectedRoute requireSuperAdmin>
                                    <UserDetailPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/users/:userId/matches/:matchId"
                            element={
                                <ProtectedRoute requireSuperAdmin>
                                    <MatchChatPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* System (super_admin only) */}
                        <Route
                            path="/admins"
                            element={
                                <ProtectedRoute requireSuperAdmin>
                                    <AdminsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/redemption-codes"
                            element={
                                <ProtectedRoute requireSuperAdmin>
                                    <RedemptionCodesPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/audit-logs"
                            element={
                                <ProtectedRoute requireSuperAdmin>
                                    <AuditLogsPage />
                                </ProtectedRoute>
                            }
                        />
                    </Route>

                    {/* Catch all - redirect to dashboard */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
