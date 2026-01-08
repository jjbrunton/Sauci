import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Search, Shield, Trash2, UserPlus, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth, AdminRole, PERMISSION_METADATA, PermissionKey } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AdminUser {
    id: string; // admin_users PK
    user_id: string;
    role: AdminRole;
    permissions: string[];
    created_at: string;
    profile?: {
        name: string | null;
        email: string | null;
        avatar_url: string | null;
    };
}

interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
}

export function AdminsPage() {
    const { user: currentUser } = useAuth();
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Add Admin State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [isSuperAdminChecked, setIsSuperAdminChecked] = useState(false);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit Permissions State
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
    const [editIsSuperAdmin, setEditIsSuperAdmin] = useState(false);
    const [editPermissions, setEditPermissions] = useState<string[]>([]);

    const fetchAdmins = useCallback(async () => {
        setLoading(true);
        try {
            // First fetch admin users with permissions
            const { data: adminData, error: adminError } = await supabase
                .from('admin_users')
                .select('id, user_id, role, permissions, created_at')
                .order('created_at', { ascending: false });

            if (adminError) throw adminError;

            // Then fetch profiles for these users
            // We do this manually to avoid relying on foreign key relationships if they aren't perfect
            if (adminData && adminData.length > 0) {
                const userIds = adminData.map(a => a.user_id);
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, name, email, avatar_url')
                    .in('id', userIds);

                if (profileError) throw profileError;

                // Merge data
                const joinedAdmins = adminData.map(admin => ({
                    ...admin,
                    permissions: (admin.permissions as string[]) || [],
                    profile: profileData?.find(p => p.id === admin.user_id)
                }));
                setAdmins(joinedAdmins);
            } else {
                setAdmins([]);
            }
        } catch (error: unknown) {
            console.error('Failed to load admins:', error);
            toast.error("Failed to load admin users");
        } finally {
            setLoading(false);
        }
    }, []);

    // Real-time subscription for admin_users table
    const { status: realtimeStatus } = useRealtimeSubscription<AdminUser>({
        table: 'admin_users',
        onInsert: fetchAdmins,
        onUpdate: fetchAdmins,
        onDelete: fetchAdmins,
        insertToast: {
            enabled: true,
            message: 'A new admin has been added',
            type: 'info',
        },
    });

    // Initial load
    useEffect(() => {
        fetchAdmins();
    }, [fetchAdmins]);

    // Search users for adding
    useEffect(() => {
        const searchUsers = async () => {
            if (!userSearch.trim()) {
                setSearchResults([]);
                return;
            }

            setSearchingUsers(true);
            try {
                // Determine which users are already admins to exclude them
                const adminUserIds = new Set(admins.map(a => a.user_id));

                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, name, email, avatar_url')
                    .or(`email.ilike.%${userSearch}%,name.ilike.%${userSearch}%`)
                    .limit(5);

                if (error) throw error;

                // Filter out existing admins
                const availableUsers = (data || []).filter(u => !adminUserIds.has(u.id));
                setSearchResults(availableUsers);
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setSearchingUsers(false);
            }
        };

        const debounce = setTimeout(searchUsers, 500);
        return () => clearTimeout(debounce);
    }, [userSearch, admins]);

    const handleAddAdmin = async () => {
        if (!selectedUser) return;

        setIsSubmitting(true);
        try {
            const role: AdminRole = isSuperAdminChecked ? 'super_admin' : 'pack_creator';
            const permissions = isSuperAdminChecked ? [] : selectedPermissions;

            const { error } = await auditedSupabase.insert('admin_users', {
                user_id: selectedUser.id,
                role,
                permissions
            });

            if (error) throw error;

            const roleLabel = isSuperAdminChecked ? 'Super Admin' : 'Admin';
            toast.success(`${selectedUser.name || selectedUser.email} added as ${roleLabel}`);

            setIsAddDialogOpen(false);
            setSelectedUser(null);
            setUserSearch('');
            setIsSuperAdminChecked(false);
            setSelectedPermissions([]);
            fetchAdmins();
        } catch (error: any) {
            console.error('Failed to add admin:', error);
            toast.error(error.message || "Failed to add admin");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditPermissions = (admin: AdminUser) => {
        setEditingAdmin(admin);
        setEditIsSuperAdmin(admin.role === 'super_admin');
        setEditPermissions(admin.permissions || []);
        setIsEditDialogOpen(true);
    };

    const handleSavePermissions = async () => {
        if (!editingAdmin) return;

        setIsSubmitting(true);
        try {
            const role: AdminRole = editIsSuperAdmin ? 'super_admin' : 'pack_creator';
            const permissions = editIsSuperAdmin ? [] : editPermissions;

            const { error } = await auditedSupabase.update('admin_users', editingAdmin.id, {
                role,
                permissions
            });

            if (error) throw error;

            toast.success("Permissions updated successfully");

            setIsEditDialogOpen(false);
            setEditingAdmin(null);
            fetchAdmins();
        } catch (error: any) {
            console.error('Failed to update permissions:', error);
            toast.error(error.message || "Failed to update permissions");
        } finally {
            setIsSubmitting(false);
        }
    };

    const togglePermission = (permission: string, isEdit: boolean) => {
        if (isEdit) {
            setEditPermissions(prev =>
                prev.includes(permission)
                    ? prev.filter(p => p !== permission)
                    : [...prev, permission]
            );
        } else {
            setSelectedPermissions(prev =>
                prev.includes(permission)
                    ? prev.filter(p => p !== permission)
                    : [...prev, permission]
            );
        }
    };

    const handleRemoveAdmin = async (admin: AdminUser) => {
        if (!confirm(`Are you sure you want to remove access for ${admin.profile?.name || admin.profile?.email || 'this user'}?`)) {
            return;
        }

        try {
            const { error } = await auditedSupabase.deleteBy('admin_users', 'user_id', admin.user_id);

            if (error) throw error;

            toast.success("Admin access revoked");

            fetchAdmins();
        } catch (error: any) {
            toast.error("Failed to remove admin");
        }
    };

    const filteredAdmins = admins.filter(admin => {
        if (!search) return true;
        const query = search.toLowerCase();
        return (
            admin.profile?.name?.toLowerCase().includes(query) ||
            admin.profile?.email?.toLowerCase().includes(query) ||
            admin.role.includes(query)
        );
    });

    const totalCount = filteredAdmins.length;
    const paginatedAdmins = filteredAdmins.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, pageSize, totalCount]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">Admin Management</h1>
                        <RealtimeStatusIndicator status={realtimeStatus} showLabel />
                    </div>
                    <p className="text-muted-foreground">
                        Manage system administrators and their roles
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search admins..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add Admin
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Add Administrator</DialogTitle>
                                <DialogDescription>
                                    Search for an existing user to grant admin access.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Select User</Label>
                                    {selectedUser ? (
                                        <div className="flex items-center justify-between p-2 border rounded-md">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={selectedUser.avatar_url || undefined} />
                                                    <AvatarFallback>{selectedUser.name?.charAt(0) || 'U'}</AvatarFallback>
                                                </Avatar>
                                                <div className="text-sm">
                                                    <div className="font-medium">{selectedUser.name || 'Unnamed'}</div>
                                                    <div className="text-xs text-muted-foreground">{selectedUser.email}</div>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>Change</Button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by name or email"
                                                value={userSearch}
                                                onChange={(e) => setUserSearch(e.target.value)}
                                                className="pl-8"
                                            />
                                            {userSearch && (
                                                <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
                                                    {searchingUsers && <div className="p-2 text-sm text-center text-muted-foreground">Searching...</div>}
                                                    {!searchingUsers && searchResults.length === 0 && (
                                                        <div className="p-2 text-sm text-center text-muted-foreground">No eligible users found</div>
                                                    )}
                                                    {searchResults.map(user => (
                                                        <div
                                                            key={user.id}
                                                            className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer text-sm"
                                                            onClick={() => setSelectedUser(user)}
                                                        >
                                                            <Avatar className="h-6 w-6">
                                                                <AvatarImage src={user.avatar_url || undefined} />
                                                                <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 overflow-hidden">
                                                                <div className="truncate font-medium">{user.name || 'Unnamed'}</div>
                                                                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                <div className="grid gap-3">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="super-admin"
                                            checked={isSuperAdminChecked}
                                            onCheckedChange={(checked) => setIsSuperAdminChecked(checked === true)}
                                        />
                                        <label
                                            htmlFor="super-admin"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            Super Admin (grants all permissions)
                                        </label>
                                    </div>

                                    {!isSuperAdminChecked && (
                                        <>
                                            <Separator />

                                            <div className="space-y-3">
                                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Content Permissions
                                                </Label>
                                                {Object.entries(PERMISSION_METADATA)
                                                    .filter(([_, meta]) => meta.group === 'content')
                                                    .map(([key, meta]) => (
                                                        <div key={key} className="flex items-start space-x-2">
                                                            <Checkbox
                                                                id={`add-${key}`}
                                                                checked={selectedPermissions.includes(key)}
                                                                onCheckedChange={() => togglePermission(key, false)}
                                                            />
                                                            <div className="grid gap-0.5 leading-none">
                                                                <label
                                                                    htmlFor={`add-${key}`}
                                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                                >
                                                                    {meta.label}
                                                                </label>
                                                                <p className="text-xs text-muted-foreground">{meta.description}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    User Permissions
                                                </Label>
                                                {Object.entries(PERMISSION_METADATA)
                                                    .filter(([_, meta]) => meta.group === 'users')
                                                    .map(([key, meta]) => (
                                                        <div key={key} className="flex items-start space-x-2">
                                                            <Checkbox
                                                                id={`add-${key}`}
                                                                checked={selectedPermissions.includes(key)}
                                                                onCheckedChange={() => togglePermission(key, false)}
                                                            />
                                                            <div className="grid gap-0.5 leading-none">
                                                                <label
                                                                    htmlFor={`add-${key}`}
                                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                                >
                                                                    {meta.label}
                                                                </label>
                                                                <p className="text-xs text-muted-foreground">{meta.description}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    System Permissions
                                                </Label>
                                                {Object.entries(PERMISSION_METADATA)
                                                    .filter(([_, meta]) => meta.group === 'system')
                                                    .map(([key, meta]) => (
                                                        <div key={key} className="flex items-start space-x-2">
                                                            <Checkbox
                                                                id={`add-${key}`}
                                                                checked={selectedPermissions.includes(key)}
                                                                onCheckedChange={() => togglePermission(key, false)}
                                                            />
                                                            <div className="grid gap-0.5 leading-none">
                                                                <label
                                                                    htmlFor={`add-${key}`}
                                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                                >
                                                                    {meta.label}
                                                                </label>
                                                                <p className="text-xs text-muted-foreground">{meta.description}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddAdmin} disabled={!selectedUser || isSubmitting}>
                                    {isSubmitting ? 'Adding...' : 'Add Access'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Admin User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role / Permissions</TableHead>
                            <TableHead>Added On</TableHead>
                            <TableHead className="w-[120px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                    <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                </TableCell>
                            </TableRow>
                        ) : filteredAdmins.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No admin users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedAdmins.map((admin) => (
                                <TableRow key={admin.user_id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={admin.profile?.avatar_url || undefined} />
                                                <AvatarFallback>
                                                    {admin.profile?.name?.charAt(0).toUpperCase() || 'A'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">
                                                {admin.profile?.name || 'Unknown User'}
                                            </span>
                                            {admin.user_id === currentUser?.id && (
                                                <Badge variant="outline" className="ml-2">You</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {admin.profile?.email || '—'}
                                    </TableCell>
                                    <TableCell>
                                        {admin.role === 'super_admin' ? (
                                            <Badge variant="default">
                                                <Shield className="h-3 w-3 mr-1" />
                                                Super Admin
                                            </Badge>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {admin.permissions.length === 0 ? (
                                                    <span className="text-muted-foreground text-sm">No permissions</span>
                                                ) : (
                                                    admin.permissions.slice(0, 3).map(perm => (
                                                        <Badge key={perm} variant="secondary" className="text-xs">
                                                            {PERMISSION_METADATA[perm as PermissionKey]?.label.replace('Can ', '') || perm}
                                                        </Badge>
                                                    ))
                                                )}
                                                {admin.permissions.length > 3 && (
                                                    <Badge variant="outline" className="text-xs">
                                                        +{admin.permissions.length - 3} more
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {admin.created_at ? format(new Date(admin.created_at), 'MMM d, yyyy') : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {admin.user_id !== currentUser?.id && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEditPermissions(admin)}
                                                        title="Edit Permissions"
                                                    >
                                                        <Settings className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveAdmin(admin)}
                                                        title="Revoke Access"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {filteredAdmins.length > 0 && (
                <PaginationControls
                    page={page}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPage(1);
                        setPageSize(size);
                    }}
                />
            )}

            {/* Edit Permissions Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Edit Permissions</DialogTitle>
                        <DialogDescription>
                            Update permissions for {editingAdmin?.profile?.name || editingAdmin?.profile?.email || 'this admin'}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="edit-super-admin"
                                    checked={editIsSuperAdmin}
                                    onCheckedChange={(checked) => setEditIsSuperAdmin(checked === true)}
                                />
                                <label
                                    htmlFor="edit-super-admin"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Super Admin (grants all permissions)
                                </label>
                            </div>

                            {!editIsSuperAdmin && (
                                <>
                                    <Separator />

                                    <div className="space-y-3">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Content Permissions
                                        </Label>
                                        {Object.entries(PERMISSION_METADATA)
                                            .filter(([_, meta]) => meta.group === 'content')
                                            .map(([key, meta]) => (
                                                <div key={key} className="flex items-start space-x-2">
                                                    <Checkbox
                                                        id={`edit-${key}`}
                                                        checked={editPermissions.includes(key)}
                                                        onCheckedChange={() => togglePermission(key, true)}
                                                    />
                                                    <div className="grid gap-0.5 leading-none">
                                                        <label
                                                            htmlFor={`edit-${key}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                        >
                                                            {meta.label}
                                                        </label>
                                                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            User Permissions
                                        </Label>
                                        {Object.entries(PERMISSION_METADATA)
                                            .filter(([_, meta]) => meta.group === 'users')
                                            .map(([key, meta]) => (
                                                <div key={key} className="flex items-start space-x-2">
                                                    <Checkbox
                                                        id={`edit-${key}`}
                                                        checked={editPermissions.includes(key)}
                                                        onCheckedChange={() => togglePermission(key, true)}
                                                    />
                                                    <div className="grid gap-0.5 leading-none">
                                                        <label
                                                            htmlFor={`edit-${key}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                        >
                                                            {meta.label}
                                                        </label>
                                                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            System Permissions
                                        </Label>
                                        {Object.entries(PERMISSION_METADATA)
                                            .filter(([_, meta]) => meta.group === 'system')
                                            .map(([key, meta]) => (
                                                <div key={key} className="flex items-start space-x-2">
                                                    <Checkbox
                                                        id={`edit-${key}`}
                                                        checked={editPermissions.includes(key)}
                                                        onCheckedChange={() => togglePermission(key, true)}
                                                    />
                                                    <div className="grid gap-0.5 leading-none">
                                                        <label
                                                            htmlFor={`edit-${key}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                        >
                                                            {meta.label}
                                                        </label>
                                                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSavePermissions} disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
