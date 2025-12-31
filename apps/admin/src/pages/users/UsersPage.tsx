import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Search, Crown, Users, ChevronRight, HardDrive } from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    is_premium: boolean | null;
    couple_id: string | null;
    created_at: string | null;
    storage_bytes?: number;
    partner_is_premium?: boolean;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function UsersPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);

    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch profiles
            const { data: profilesData, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch storage usage per user from storage.objects
            const { data: storageData } = await supabase
                .rpc('get_user_storage_usage');

            // Create a map of user_id -> storage_bytes
            const storageMap: Record<string, number> = {};
            if (storageData) {
                storageData.forEach((row: { owner: string; total_bytes: number }) => {
                    storageMap[row.owner] = row.total_bytes;
                });
            }

            // Build a map of couple_id -> users with premium in that couple
            const couplePartners: Record<string, { id: string; is_premium: boolean }[]> = {};
            (profilesData || []).forEach(profile => {
                if (profile.couple_id) {
                    if (!couplePartners[profile.couple_id]) {
                        couplePartners[profile.couple_id] = [];
                    }
                    couplePartners[profile.couple_id].push({
                        id: profile.id,
                        is_premium: profile.is_premium || false,
                    });
                }
            });

            // Merge storage data and partner premium status with profiles
            const profilesWithExtras = (profilesData || []).map(profile => {
                // Check if partner has premium
                let partnerIsPremium = false;
                if (profile.couple_id && couplePartners[profile.couple_id]) {
                    const partner = couplePartners[profile.couple_id].find(p => p.id !== profile.id);
                    partnerIsPremium = partner?.is_premium || false;
                }
                return {
                    ...profile,
                    storage_bytes: storageMap[profile.id] || 0,
                    partner_is_premium: partnerIsPremium,
                };
            });

            setProfiles(profilesWithExtras);
            setFilteredProfiles(profilesWithExtras);
        } catch (error) {
            console.error('Failed to load profiles:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Real-time subscription for profiles table
    const { status: realtimeStatus } = useRealtimeSubscription<Profile>({
        table: 'profiles',
        onInsert: useCallback(() => {
            // Refetch to get storage and partner data
            fetchProfiles();
        }, [fetchProfiles]),
        onUpdate: useCallback(() => {
            // Refetch to update partner premium status
            fetchProfiles();
        }, [fetchProfiles]),
        onDelete: useCallback((deleted: Profile) => {
            setProfiles(prev => prev.filter(p => p.id !== deleted.id));
            setFilteredProfiles(prev => prev.filter(p => p.id !== deleted.id));
        }, []),
        insertToast: {
            enabled: true,
            message: (payload) => `New user registered: ${payload.name || payload.email || 'Unknown'}`,
            type: 'success',
        },
        debounceMs: 1000, // Debounce to avoid excessive refetches
    });

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    useEffect(() => {
        if (!search.trim()) {
            setFilteredProfiles(profiles);
            return;
        }

        const query = search.toLowerCase();
        setFilteredProfiles(
            profiles.filter(
                p =>
                    p.name?.toLowerCase().includes(query) ||
                    p.email?.toLowerCase().includes(query) ||
                    p.id.toLowerCase().includes(query)
            )
        );
    }, [search, profiles]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-10 w-64" />
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
                        <RealtimeStatusIndicator status={realtimeStatus} showLabel />
                    </div>
                    <p className="text-muted-foreground">
                        {profiles.length} registered user{profiles.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Couple</TableHead>
                            <TableHead>Storage</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProfiles.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    {search ? 'No users found matching your search.' : 'No users yet.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProfiles.map((profile) => (
                                <TableRow key={profile.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={profile.avatar_url || undefined} />
                                                <AvatarFallback>
                                                    {profile.name?.charAt(0).toUpperCase() || 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">
                                                {profile.name || 'Unnamed User'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {profile.email || '—'}
                                    </TableCell>
                                    <TableCell>
                                        {profile.is_premium ? (
                                            <Badge className="bg-amber-500">
                                                <Crown className="h-3 w-3 mr-1" />
                                                Premium
                                            </Badge>
                                        ) : profile.partner_is_premium ? (
                                            <Badge className="bg-amber-500/70">
                                                <Crown className="h-3 w-3 mr-1" />
                                                Partner
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-200">
                                                Free
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {profile.couple_id ? (
                                            <Badge variant="secondary">
                                                <Users className="h-3 w-3 mr-1" />
                                                Paired
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {profile.storage_bytes && profile.storage_bytes > 0 ? (
                                            <div className="flex items-center gap-1 text-sm">
                                                <HardDrive className="h-3 w-3 text-muted-foreground" />
                                                {formatBytes(profile.storage_bytes)}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {profile.created_at
                                            ? format(new Date(profile.created_at), 'MMM d, yyyy')
                                            : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Link to={`/users/${profile.id}`}>
                                            <Button variant="ghost" size="icon">
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </Link>
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
