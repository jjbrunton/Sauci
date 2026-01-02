import { useState, useEffect } from 'react';
import { supabase } from '@/config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, CheckCircle, AlertTriangle, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface FlaggedMessage {
    id: string;
    created_at: string;
    user_id: string;
    moderation_status: 'flagged' | 'safe' | 'unmoderated';
    flag_reason: string | null;
    content?: string; // Encrypted usually
    media_path?: string;
    media_type?: string;
}

export function FlaggedMessagesPage() {
    const [messages, setMessages] = useState<FlaggedMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState<FlaggedMessage | null>(null);
    const [decryptedContent, setDecryptedContent] = useState<{ text: string | null; mediaUrl: string | null }>({ text: null, mediaUrl: null });
    const [decrypting, setDecrypting] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null); // messageId being processed

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('id, created_at, user_id, moderation_status, flag_reason, content, media_path, media_type')
                .eq('moderation_status', 'flagged')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Failed to load flagged messages:', error);
            toast.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const handleView = async (message: FlaggedMessage) => {
        setSelectedMessage(message);
        setDecrypting(true);
        setDecryptedContent({ text: null, mediaUrl: null });

        try {
            // Call edge function to decrypt
            // We use admin-decrypt-message for text
            let text = null;
            let mediaUrl = null;

            // 1. Decrypt Text/Metadata
            const { data: decryptData, error: decryptError } = await supabase.functions.invoke('admin-decrypt-message', {
                body: { messageId: message.id }
            });

            if (decryptError) throw decryptError;

            if (decryptData) {
                text = decryptData.content;
                
                // 2. Handle Media
                // If it has media, admin-decrypt-message returns media_path but not the file content directly decrypted usually
                // But admin-decrypt-media function returns the raw bytes
                if (decryptData.media_path) {
                    const { data: mediaBlob, error: mediaError } = await supabase.functions.invoke('admin-decrypt-media', {
                        body: { messageId: message.id },
                        // Response is a blob/file usually? 
                        // supabase.functions.invoke by default parses JSON.
                        // We might need to handle blob response.
                    });

                    // Invoke returns data as parsed JSON if header is json, or blob?
                    // The admin-decrypt-media returns binary body. 
                    // Supabase js client might try to parse it. 
                    // We might need a direct fetch or handle responseType.
                }
            }
            
            // NOTE: For now, displaying text content. Media decryption in frontend via edge function binary response 
            // is tricky with supabase-js invoke(). 
            // We will just show the text for now or implement media later if critical.
            // Actually, we can just use a direct fetch with the user's session token.
            
            setDecryptedContent({ text, mediaUrl });
            
        } catch (error) {
            console.error('Decryption failed:', error);
            toast.error('Failed to decrypt content');
            setDecryptedContent({ text: 'Error decrypting content', mediaUrl: null });
        } finally {
            setDecrypting(false);
        }
    };
    
    // Custom media fetcher because supabase.functions.invoke is JSON-centric
    const fetchDecryptedMedia = async (messageId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return null;

            const response = await fetch(`https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/admin-decrypt-media`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messageId })
            });

            if (!response.ok) throw new Error('Failed to fetch media');
            
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error(e);
            return null;
        }
    };
    
    // Improved handleView with media support
    const handleViewComplete = async (message: FlaggedMessage) => {
        setSelectedMessage(message);
        setDecrypting(true);
        setDecryptedContent({ text: null, mediaUrl: null });
        
        try {
            // Text
            const { data: textData, error: textError } = await supabase.functions.invoke('admin-decrypt-message', {
                 body: { messageId: message.id }
            });
            
            let mediaUrl = null;
            if (message.media_path) {
                mediaUrl = await fetchDecryptedMedia(message.id);
            }
            
            setDecryptedContent({ 
                text: textData?.content || (textError ? 'Error decrypting text' : null), 
                mediaUrl 
            });

        } catch (e) {
             toast.error("Error loading content");
        } finally {
            setDecrypting(false);
        }
    };

    const handleMarkSafe = async (messageId: string) => {
        setProcessing(messageId);
        try {
            const { error } = await supabase
                .from('messages')
                .update({ moderation_status: 'safe' })
                .eq('id', messageId);

            if (error) throw error;
            
            toast.success('Message marked as safe');
            setMessages(prev => prev.filter(m => m.id !== messageId));
            if (selectedMessage?.id === messageId) setSelectedMessage(null);
        } catch (error) {
            toast.error('Failed to update status');
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Flagged Messages</h1>
                    <p className="text-muted-foreground">
                        Review content flagged by AI moderation
                    </p>
                </div>
                <Button variant="outline" onClick={fetchMessages} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {messages.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <CheckCircle className="h-8 w-8 text-green-500/50" />
                                        <p>No flagged messages found. Good job!</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            messages.map((message) => (
                                <TableRow key={message.id}>
                                    <TableCell className="font-mono text-sm">
                                        {format(new Date(message.created_at), 'MMM d, HH:mm')}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0">
                                            {message.flag_reason || 'Unknown'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {message.media_path ? (
                                            <Badge variant="outline">{message.media_type || 'Media'}</Badge>
                                        ) : (
                                            <Badge variant="secondary">Text</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleViewComplete(message)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" />
                                            Review
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onClick={() => handleMarkSafe(message.id)}
                                            disabled={processing === message.id}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Mark Safe
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Review Content</DialogTitle>
                        <DialogDescription>
                            Decrypted content for review. Flagged for: {selectedMessage?.flag_reason}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="min-h-[200px] bg-muted/30 rounded-md p-4 flex items-center justify-center">
                        {decrypting ? (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <RefreshCw className="h-6 w-6 animate-spin" />
                                <p className="text-sm">Decrypting secure content...</p>
                            </div>
                        ) : (
                            <div className="w-full space-y-4">
                                {decryptedContent.text && (
                                    <div className="bg-background border rounded p-3 text-sm">
                                        {decryptedContent.text}
                                    </div>
                                )}
                                {decryptedContent.mediaUrl && (
                                    <div className="flex justify-center">
                                        {selectedMessage?.media_type === 'video' ? (
                                            <video src={decryptedContent.mediaUrl} controls className="max-h-[400px] rounded" />
                                        ) : (
                                            <img src={decryptedContent.mediaUrl} alt="Flagged content" className="max-h-[400px] rounded object-contain" />
                                        )}
                                    </div>
                                )}
                                {!decryptedContent.text && !decryptedContent.mediaUrl && (
                                    <p className="text-center text-muted-foreground">No content displayed</p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedMessage(null)}>Cancel</Button>
                        <Button 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => selectedMessage && handleMarkSafe(selectedMessage.id)}
                        >
                            Mark Safe
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
