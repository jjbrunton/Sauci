import { useState, useRef, useEffect, useMemo } from 'react';
import emojiData from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Button } from './button';

interface EmojiPickerProps {
    value: string;
    onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
    // Clone data to avoid "Cannot assign to read only property" error in production
    const data = useMemo(() => JSON.parse(JSON.stringify(emojiData)), []);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open]);

    const handleEmojiSelect = (emoji: any) => {
        onChange(emoji.native);
        setOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <Button
                type="button"
                variant="outline"
                className="w-16 h-16 text-3xl"
                onClick={() => setOpen(!open)}
            >
                {value || '📚'}
            </Button>
            {open && (
                <div className="absolute top-full left-0 mt-2 z-50">
                    <Picker
                        data={data}
                        onEmojiSelect={handleEmojiSelect}
                        theme="light"
                        previewPosition="none"
                        skinTonePosition="none"
                    />
                </div>
            )}
        </div>
    );
}
