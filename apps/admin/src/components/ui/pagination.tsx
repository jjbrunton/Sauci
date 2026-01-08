import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type PaginationControlsProps = {
    page: number;
    pageSize: number;
    totalCount: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    showPageSize?: boolean;
    className?: string;
};

export function PaginationControls({
    page,
    pageSize,
    totalCount,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50],
    showPageSize = true,
    className,
}: PaginationControlsProps) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const end = totalCount === 0 ? 0 : Math.min(safePage * pageSize, totalCount);

    return (
        <div
            className={cn(
                'flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between',
                className
            )}
        >
            <div>
                {totalCount === 0
                    ? 'No results'
                    : `Showing ${start} to ${end} of ${totalCount}`}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {showPageSize && onPageSizeChange && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Rows</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(value) => onPageSizeChange(Number(value))}
                        >
                            <SelectTrigger className="h-8 w-[90px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {pageSizeOptions.map((size) => (
                                    <SelectItem key={size} value={String(size)}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(Math.max(1, safePage - 1))}
                        disabled={safePage <= 1}
                    >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Prev
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        Page {safePage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
                        disabled={safePage >= totalPages}
                    >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
