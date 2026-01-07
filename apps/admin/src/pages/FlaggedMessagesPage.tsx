import React, { useState, useEffect } from 'react';
import { supabase } from '@/config';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Eye, RefreshCw, MessageSquare, Sparkles, Flag, AlertTriangle, XCircle } from 'lucide-react';
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

interface UserReport {
    id: string;
    message_id: string;
    reporter_id: string;
    reason: string;
    status: 'pending' | 'reviewed' | 'dismissed';
    created_at: string;
    message: {
        id: string;
        user_id: string;
        match_id: string | null;
        content: string | null;
        media_path: string | null;
        media_type: string | null;
    } | null;
    reporter_profile: {
        name: string | null;
        email: string | null;
    } | null;
}

const REASON_LABELS: Record<string, string> = {
    harassment: 'Harassment',
    spam: 'Spam',
    inappropriate_content: 'Inappropriate Content',
    other: 'Other',
};

export function FlaggedMessagesPage() {
    const navigate = useNavigate();

    // AI Flagged state
    const [aiMessages, setAiMessages] = useState<FlaggedMessage[]>([]);
    const [aiLoading, setAiLoading] = useState(true);

    // User Reports state
    const [userReports, setUserReports] = useState<UserReport[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);

    // Shared state
    const [selectedMessage, setSelectedMessage] = useState<FlaggedMessage | null>(null);
    const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
    const [decryptedContent, setDecryptedContent] = useState<{ text: string | null; mediaUrl: string | null }>({ text: null, mediaUrl: null });
    const [decrypting, setDecrypting] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const [imageDescription, setImageDescription] = useState<string | null>(null);
    const [describing, setDescribing] = useState(false);
    const [inlineDescriptions, setInlineDescriptions] = useState<Record<string, string>>({});
    const [describingInline, setDescribingInline] = useState<string | null>(null);

    // Fetch AI flagged messages
    const fetchAiMessages = async () => {
        setAiLoading(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('id, created_at, user_id, match_id, moderation_status, flag_reason, content, media_path, media_type')
                .eq('moderation_status', 'flagged')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAiMessages(data || []);
        } catch (error) {
            console.error('Failed to load flagged messages:', error);
            toast.error('Failed to load messages');
        } finally {
            setAiLoading(false);
        }
    };

    // Fetch user reports
    const fetchUserReports = async () => {
        setReportsLoading(true);
        try {
            const { data, error } = await supabase
                .from('message_reports')
                .select(`
                    id,
                    message_id,
                    reporter_id,
                    reason,
                    status,
                    created_at,
                    message:messages(id, user_id, match_id, content, media_path, media_type),
                    reporter_profile:profiles!reporter_id(name, email)
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUserReports((data || []) as unknown as UserReport[]);
        } catch (error) {
            console.error('Failed to load user reports:', error);
            toast.error('Failed to load reports');
        } finally {
            setReportsLoading(false);
        }
    };

    useEffect(() => {
        fetchAiMessages();
        fetchUserReports();
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

    const handleViewAiMessage = async (message: FlaggedMessage) => {
        setSelectedMessage(message);
        setSelectedReport(null);
        setDecrypting(true);
        setDecryptedContent({ text: null, mediaUrl: null });
        setImageDescription(null);

        try {
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

    const handleViewReport = async (report: UserReport) => {
        if (!report.message) {
            toast.error('Message no longer exists');
            return;
        }

        setSelectedReport(report);
        setSelectedMessage(null);
        setDecrypting(true);
        setDecryptedContent({ text: null, mediaUrl: null });
        setImageDescription(null);

        try {
            const { data: textData, error: textError } = await supabase.functions.invoke('admin-decrypt-message', {
                 body: { messageId: report.message.id }
            });

            let mediaUrl = null;
            if (report.message.media_path) {
                mediaUrl = await fetchDecryptedMedia(report.message.id);
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

            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

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
            setAiMessages(prev => prev.filter(m => m.id !== messageId));
            if (selectedMessage?.id === messageId) setSelectedMessage(null);
        } catch (error) {
            toast.error('Failed to update status');
        } finally {
            setProcessing(null);
        }
    };

    const handleDismissReport = async (reportId: string) => {
        setProcessing(reportId);
        try {
            const { error } = await supabase
                .from('message_reports')
                .update({ status: 'dismissed', reviewed_at: new Date().toISOString() })
                .eq('id', reportId);

            if (error) throw error;

            toast.success('Report dismissed');
            setUserReports(prev => prev.filter(r => r.id !== reportId));
            if (selectedReport?.id === reportId) setSelectedReport(null);
        } catch (error) {
            toast.error('Failed to dismiss report');
        } finally {
            setProcessing(null);
        }
    };

    const handleReviewReport = async (reportId: string) => {
        setProcessing(reportId);
        try {
            const { error } = await supabase
                .from('message_reports')
                .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
                .eq('id', reportId);

            if (error) throw error;

            toast.success('Report marked as reviewed');
            setUserReports(prev => prev.filter(r => r.id !== reportId));
            if (selectedReport?.id === reportId) setSelectedReport(null);
        } catch (error) {
            toast.error('Failed to update report');
        } finally {
            setProcessing(null);
        }
    };

    const handleJumpToChat = () => {
        const matchId = selectedMessage?.match_id || selectedReport?.message?.match_id;
        const userId = selectedMessage?.user_id || selectedReport?.message?.user_id;

        if (!matchId) {
             toast.error("No match context available");
             return;
        }
        navigate(`/users/${userId}/matches/${matchId}`);
    };

    const closeDialogs = () => {
        setSelectedMessage(null);
        setSelectedReport(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Content Moderation</h1>
                    <p className="text-muted-foreground">
                        Review AI-flagged content and user reports
                    </p>
                </div>
            </div>

            <Tabs defaultValue="ai-flagged" className="w-full">
                <TabsList>
                    <TabsTrigger value="ai-flagged" className="gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        AI Flagged
                        {aiMessages.length > 0 && (
                            <Badge variant="secondary" className="ml-1">{aiMessages.length}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="user-reports" className="gap-2">
                        <Flag className="h-4 w-4" />
                        User Reports
                        {userReports.length > 0 && (
                            <Badge variant="secondary" className="ml-1">{userReports.length}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="ai-flagged" className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={fetchAiMessages} disabled={aiLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${aiLoading ? 'animate-spin' : ''}`} />
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
                                {aiMessages.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircle className="h-8 w-8 text-green-500/50" />
                                                <p>No AI-flagged messages found. Good job!</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    aiMessages.map((message) => (
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
                                                    onClick={() => handleViewAiMessage(message)}
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
                </TabsContent>

                <TabsContent value="user-reports" className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={fetchUserReports} disabled={reportsLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${reportsLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>

                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Reporter</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userReports.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircle className="h-8 w-8 text-green-500/50" />
                                                <p>No pending user reports. All clear!</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    userReports.map((report) => (
                                        <TableRow key={report.id}>
                                            <TableCell className="font-mono text-sm">
                                                {format(new Date(report.created_at), 'MMM d, HH:mm')}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {report.reporter_profile?.name || report.reporter_profile?.email || 'Unknown'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                                                    {REASON_LABELS[report.reason] || report.reason}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {report.message?.media_path ? (
                                                    <Badge variant="outline">{report.message.media_type || 'Media'}</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Text</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewReport(report)}
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Review
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                    onClick={() => handleDismissReport(report.id)}
                                                    disabled={processing === report.id}
                                                >
                                                    <XCircle className="h-4 w-4 mr-2" />
                                                    Dismiss
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => handleReviewReport(report.id)}
                                                    disabled={processing === report.id}
                                                >
                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                    Mark Reviewed
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Review Dialog - AI Flagged Messages */}
            <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && closeDialogs()}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Review AI Flagged Content</DialogTitle>
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
                            <Button variant="ghost" onClick={closeDialogs}>Cancel</Button>
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

            {/* Review Dialog - User Reports */}
            <Dialog open={!!selectedReport} onOpenChange={(open) => !open && closeDialogs()}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Review User Report</DialogTitle>
                        <DialogDescription>
                            Reported by: {selectedReport?.reporter_profile?.name || selectedReport?.reporter_profile?.email || 'Unknown'}
                            <br />
                            Reason: {selectedReport?.reason ? (REASON_LABELS[selectedReport.reason] || selectedReport.reason) : 'Unknown'}
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
                                            {selectedReport?.message?.media_type !== 'video' && (
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
                                            {selectedReport?.message?.media_type === 'video' ? (
                                                <video src={decryptedContent.mediaUrl} controls className="max-h-[400px] w-full object-contain" />
                                            ) : (
                                                <img src={decryptedContent.mediaUrl} alt="Reported content" className="max-h-[400px] w-full object-contain" />
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
                            <Button variant="ghost" onClick={closeDialogs}>Cancel</Button>
                            <Button
                                variant="outline"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                onClick={() => selectedReport && handleDismissReport(selectedReport.id)}
                            >
                                Dismiss
                            </Button>
                            <Button
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => selectedReport && handleReviewReport(selectedReport.id)}
                            >
                                Mark Reviewed
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
