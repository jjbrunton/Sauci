/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_OPENAI_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Type declarations for emoji-mart packages
declare module '@emoji-mart/data' {
    const data: Record<string, unknown>;
    export default data;
}

declare module '@emoji-mart/react' {
    import { ComponentType } from 'react';

    interface PickerProps {
        data: Record<string, unknown>;
        onEmojiSelect: (emoji: { native: string; id: string; name: string }) => void;
        theme?: 'light' | 'dark' | 'auto';
        previewPosition?: 'top' | 'bottom' | 'none';
        skinTonePosition?: 'preview' | 'search' | 'none';
        searchPosition?: 'sticky' | 'static' | 'none';
        navPosition?: 'top' | 'bottom' | 'none';
        perLine?: number;
        maxFrequentRows?: number;
        emojiSize?: number;
        emojiButtonSize?: number;
        emojiButtonRadius?: string;
        emojiButtonColors?: string[];
        icons?: 'auto' | 'outline' | 'solid';
        set?: 'native' | 'apple' | 'facebook' | 'google' | 'twitter';
        locale?: string;
        autoFocus?: boolean;
        dynamicWidth?: boolean;
    }

    const Picker: ComponentType<PickerProps>;
    export default Picker;
}
