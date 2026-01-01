import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, PERMISSION_KEYS } from '@/contexts/AuthContext';
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
import { FeedbackPage } from '@/pages/FeedbackPage';
import { UsageInsightsPage } from '@/pages/UsageInsightsPage';
import { UserActivityPage } from '@/pages/activity/UserActivityPage';
import { AiSettingsPage } from '@/pages/AiSettingsPage';
import { AppSettingsPage } from '@/pages/AppSettingsPage';

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
                        <Route
                            path="/categories"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.MANAGE_CATEGORIES}>
                                    <CategoriesPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/categories/:categoryId/packs"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.MANAGE_PACKS}>
                                    <PacksPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/packs/:packId/questions"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.MANAGE_QUESTIONS}>
                                    <QuestionsPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* User management */}
                        <Route
                            path="/users"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.VIEW_USERS}>
                                    <UsersPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/users/:userId"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.VIEW_USERS}>
                                    <UserDetailPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/users/:userId/matches/:matchId"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.VIEW_CHATS}>
                                    <MatchChatPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/usage-insights"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.VIEW_USERS}>
                                    <UsageInsightsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/activity"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.VIEW_ACTIVITY}>
                                    <UserActivityPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* System */}
                        <Route
                            path="/admins"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.MANAGE_ADMINS}>
                                    <AdminsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/redemption-codes"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.MANAGE_CODES}>
                                    <RedemptionCodesPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/audit-logs"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.VIEW_AUDIT_LOGS}>
                                    <AuditLogsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/feedback"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.MANAGE_FEEDBACK}>
                                    <FeedbackPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/ai-settings"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.MANAGE_AI_CONFIG}>
                                    <AiSettingsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/app-settings"
                            element={
                                <ProtectedRoute requiredPermission={PERMISSION_KEYS.MANAGE_APP_CONFIG}>
                                    <AppSettingsPage />
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
