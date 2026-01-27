import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { polishContent } from '@/lib/openai';
import { toast } from 'sonner';

interface AIPolishButtonProps {
    text: string;
    type: 'question' | 'partner_text' | 'pack_name' | 'pack_description' | 'category_name';
    onPolished: (newText: string) => void;
    className?: string;
    disabled?: boolean;
}

export function AIPolishButton({ text, type, onPolished, className, disabled }: AIPolishButtonProps) {
    const [loading, setLoading] = useState(false);

    const handlePolish = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent form submission
        if (!text || !text.trim()) {
            toast.error('Enter some text first to polish');
            return;
        }

        setLoading(true);
        try {
            const polished = await polishContent(text, type, false);
            onPolished(polished);
            toast.success('Text polished!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to polish text');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className={className}
            onClick={handlePolish}
            disabled={loading || disabled || !text}
            type="button"
            title="Polish with AI"
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Sparkles className="h-4 w-4 text-purple-500" />
            )}
        </Button>
    );
}
