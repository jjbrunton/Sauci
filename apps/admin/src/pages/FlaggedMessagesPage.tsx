import React, { useState, useEffect } from 'react';
import { supabase } from '@/config';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Eye, RefreshCw, MessageSquare, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { describeImage } from '@/lib/ai/analyzers/media';

interface FlaggedMessage {
    id: string;
    created_at: string;
    user_id: string;
    match_id: string | null;
    moderation_status: 'flagged' | 'safe' | 'unmoderated';
    flag_reason: string | null;
    content?: string; // Encrypted usually
    media_path?: string;
    media_type?: string;
}

export function FlaggedMessagesPage() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<FlaggedMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState<FlaggedMessage | null>(null);
    const [decryptedContent, setDecryptedContent] = useState<{ text: string | null; mediaUrl: string | null }>({ text: null, mediaUrl: null });
    const [decrypting, setDecrypting] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null); // messageId being processed
    const [imageDescription, setImageDescription] = useState<string | null>(null);
    const [describing, setDescribing] = useState(false);
    const [inlineDescriptions, setInlineDescriptions] = useState<Record<string, string>>({});
    const [describingInline, setDescribingInline] = useState<string | null>(null);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('id, created_at, user_id, match_id, moderation_status, flag_reason, content, media_path, media_type')
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
    
    const handleView = async (message: FlaggedMessage) => {
        setSelectedMessage(message);
        setDecrypting(true);
        setDecryptedContent({ text: null, mediaUrl: null });
        setImageDescription(null);
        
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

    const handleDescribeImage = async () => {
        if (!decryptedContent.mediaUrl) return;

        setDescribing(true);
        try {
            const description = await describeImage(decryptedContent.mediaUrl);
            setImageDescription(description);
        } catch (error) {
            console.error('Failed to describe image:', error);
            toast.error('Failed to describe image');
        } finally {
            setDescribing(false);
        }
    };

    const handleDescribeInline = async (message: FlaggedMessage) => {
        if (!message.media_path || message.media_type === 'video') return;

        setDescribingInline(message.id);
        try {
            // First fetch the decrypted media as blob
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('Not authenticated');
                return;
            }

            const response = await fetch(`https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/admin-decrypt-media`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messageId: message.id })
            });

            if (!response.ok) {
                toast.error('Failed to decrypt media');
                return;
            }

            // Convert blob to base64
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    // Extract base64 part from data URL
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            // Then describe it
            const description = await describeImage(base64);
            setInlineDescriptions(prev => ({ ...prev, [message.id]: description }));
        } catch (error) {
            console.error('Failed to describe image:', error);
            toast.error('Failed to describe image');
        } finally {
            setDescribingInline(null);
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

    const handleJumpToChat = () => {
        if (!selectedMessage || !selectedMessage.match_id) {
             toast.error("No match context available");
             return;
        }
        navigate(`/users/${selectedMessage.user_id}/matches/${selectedMessage.match_id}`);
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
                                <React.Fragment key={message.id}>
                                <TableRow>
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
                                            onClick={() => handleView(message)}
                                        >
                                            <Eye className="h-4 w-4 mr-2" />
                                            Review
                                        </Button>
                                        {message.media_path && message.media_type !== 'video' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDescribeInline(message)}
                                                disabled={describingInline === message.id}
                                            >
                                                {describingInline === message.id ? (
                                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-4 w-4 mr-2" />
                                                )}
                                                Describe
                                            </Button>
                                        )}
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
                                {inlineDescriptions[message.id] && (
                                    <TableRow className="bg-blue-50/50 dark:bg-blue-900/10">
                                        <TableCell colSpan={4} className="py-2">
                                            <div className="flex items-start gap-2 text-sm">
                                                <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                                <p className="text-blue-800 dark:text-blue-200">
                                                    {inlineDescriptions[message.id]}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Review Content</DialogTitle>
                        <DialogDescription>
                            Decrypted content for review. Flagged for: {selectedMessage?.flag_reason}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="min-h-[200px] bg-muted/30 rounded-md p-4 flex flex-col gap-4">
                        {decrypting ? (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                                <RefreshCw className="h-6 w-6 animate-spin" />
                                <p className="text-sm">Decrypting secure content...</p>
                            </div>
                        ) : (
                            <div className="w-full space-y-4">
                                {decryptedContent.text && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-muted-foreground">Message Text</h4>
                                        <div className="bg-background border rounded p-3 text-sm whitespace-pre-wrap">
                                            {decryptedContent.text}
                                        </div>
                                    </div>
                                )}
                                
                                {decryptedContent.mediaUrl && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-muted-foreground">Media Content</h4>
                                            {selectedMessage?.media_type !== 'video' && (
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    onClick={handleDescribeImage}
                                                    disabled={describing}
                                                >
                                                    {describing ? (
                                                        <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="h-3 w-3 mr-2" />
                                                    )}
                                                    Describe Image
                                                </Button>
                                            )}
                                        </div>
                                        
                                        <div className="flex justify-center bg-black/5 rounded-lg overflow-hidden border">
                                            {selectedMessage?.media_type === 'video' ? (
                                                <video src={decryptedContent.mediaUrl} controls className="max-h-[400px] w-full object-contain" />
                                            ) : (
                                                <img src={decryptedContent.mediaUrl} alt="Flagged content" className="max-h-[400px] w-full object-contain" />
                                            )}
                                        </div>

                                        {imageDescription && (
                                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                                                <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 flex items-center">
                                                    <Sparkles className="h-3 w-3 mr-1" />
                                                    AI Description
                                                </h5>
                                                <p className="text-sm text-blue-800 dark:text-blue-200">{imageDescription}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!decryptedContent.text && !decryptedContent.mediaUrl && (
                                    <p className="text-center text-muted-foreground py-8">No content displayed</p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:justify-between">
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={handleJumpToChat}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Jump to Chat
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setSelectedMessage(null)}>Cancel</Button>
                            <Button 
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => selectedMessage && handleMarkSafe(selectedMessage.id)}
                            >
                                Mark Safe
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

