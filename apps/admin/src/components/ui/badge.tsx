import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-primary/30 bg-primary text-white",
                secondary:
                    "border-white/20 bg-white/10 text-white",
                destructive:
                    "border-red-500/30 bg-red-500 text-white",
                outline: "border-white/30 bg-transparent text-white",
                success:
                    "border-emerald-500/30 bg-emerald-500 text-white",
                warning:
                    "border-amber-500/30 bg-amber-500 text-black",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
