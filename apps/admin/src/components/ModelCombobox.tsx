import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { useOpenRouterModels, formatContextLength, formatModelPricing, OpenRouterModel } from '@/hooks/useOpenRouterModels';
import { ChevronDown, Loader2, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelComboboxProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function ModelCombobox({
    value,
    onChange,
    placeholder = 'Select or type model ID...',
    className,
    disabled = false,
}: ModelComboboxProps) {
    const { models, loading } = useOpenRouterModels();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter models based on search
    const filteredModels = useMemo(() => {
        const query = (search || value).toLowerCase().trim();
        if (!query) {
            // Show featured models when no search
            return models.slice(0, 15);
        }

        return models
            .filter(m =>
                m.id.toLowerCase().includes(query) ||
                m.name.toLowerCase().includes(query)
            )
            .slice(0, 20);
    }, [models, search, value]);

    // Find current model info
    const currentModel = useMemo(() => {
        return models.find(m => m.id === value);
    }, [models, value]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            setSearch('');
        } else if (e.key === 'ArrowDown' && !isOpen) {
            setIsOpen(true);
        }
    };

    const handleSelect = (model: OpenRouterModel) => {
        onChange(model.id);
        setIsOpen(false);
        setSearch('');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setSearch(newValue);
        onChange(newValue);
        if (!isOpen && newValue) {
            setIsOpen(true);
        }
    };

    const handleInputFocus = () => {
        setIsOpen(true);
    };

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {/* Input with dropdown trigger */}
            <div className="relative">
                <Input
                    ref={inputRef}
                    value={search || value}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="pr-8 font-mono text-sm"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={disabled}
                    className="absolute right-0 top-0 h-full px-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                    )}
                </button>
            </div>

            {/* Current model info */}
            {currentModel && !isOpen && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                    {currentModel.name} - {formatContextLength(currentModel.context_length)} context
                </p>
            )}

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-80 overflow-auto rounded-md border bg-popover shadow-lg">
                    {loading ? (
                        <div className="flex items-center justify-center py-6 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading models...
                        </div>
                    ) : filteredModels.length === 0 ? (
                        <div className="py-6 text-center text-muted-foreground">
                            <Search className="h-4 w-4 mx-auto mb-2" />
                            <p className="text-sm">No models found</p>
                            <p className="text-xs mt-1">Type a custom model ID or refine your search</p>
                        </div>
                    ) : (
                        <div className="py-1">
                            {filteredModels.map((model, index) => {
                                const isFeatured = index < 8 && !search && !value;
                                return (
                                    <button
                                        key={model.id}
                                        type="button"
                                        onClick={() => handleSelect(model)}
                                        className={cn(
                                            'w-full px-3 py-2 text-left hover:bg-accent focus:bg-accent outline-none',
                                            model.id === value && 'bg-accent'
                                        )}
                                    >
                                        <div className="flex items-start gap-2">
                                            {isFeatured && (
                                                <Sparkles className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-mono text-sm truncate">
                                                    {model.id}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <span>{formatContextLength(model.context_length)}</span>
                                                    <span>-</span>
                                                    <span>{formatModelPricing(model)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
