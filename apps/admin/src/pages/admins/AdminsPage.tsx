import { useState, useEffect } from 'react';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Shield, Trash2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth, AdminRole } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AdminUser {
    id: string; // admin_users PK
    user_id: string;
    role: AdminRole;
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

    // Add Admin State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [selectedRole, setSelectedRole] = useState<AdminRole>('pack_creator');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial load
    useEffect(() => {
        fetchAdmins();
    }, []);

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

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            // First fetch admin users
            const { data: adminData, error: adminError } = await supabase
                .from('admin_users')
                .select('*')
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
                    profile: profileData?.find(p => p.id === admin.user_id)
                }));
                setAdmins(joinedAdmins);
            } else {
                setAdmins([]);
            }
        } catch (error: any) {
            console.error('Failed to load admins:', error);
            toast.error("Failed to load admin users");
        } finally {
            setLoading(false);
        }
    };

    const handleAddAdmin = async () => {
        if (!selectedUser) return;

        setIsSubmitting(true);
        try {
            const { error } = await auditedSupabase.insert('admin_users', {
                user_id: selectedUser.id,
                role: selectedRole
            });

            if (error) throw error;

            toast.success(`${selectedUser.name || selectedUser.email} added as ${selectedRole.replace('_', ' ')}`);

            setIsAddDialogOpen(false);
            setSelectedUser(null);
            setUserSearch('');
            fetchAdmins();
        } catch (error: any) {
            console.error('Failed to add admin:', error);
            toast.error(error.message || "Failed to add admin");
        } finally {
            setIsSubmitting(false);
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Management</h1>
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
                        <DialogContent className="sm:max-w-[425px]">
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
                                <div className="grid gap-2">
                                    <Label>Role</Label>
                                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AdminRole)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pack_creator">Pack Creator</SelectItem>
                                            <SelectItem value="super_admin">Super Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                            <TableHead>Role</TableHead>
                            <TableHead>Added On</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
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
                            filteredAdmins.map((admin) => (
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
                                        <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                                            <Shield className="h-3 w-3 mr-1" />
                                            {admin.role.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {admin.created_at ? format(new Date(admin.created_at), 'MMM d, yyyy') : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {admin.user_id !== currentUser?.id && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveAdmin(admin)}
                                                title="Revoke Access"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
