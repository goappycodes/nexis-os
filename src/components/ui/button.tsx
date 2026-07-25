import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // min-h-11 keeps every button at a comfortable thumb target on mobile.
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-pink-500 text-white hover:bg-pink-600 shadow-sm",
        secondary:
          "bg-ink-800 text-white hover:bg-ink-700 dark:bg-white dark:text-ink-800 dark:hover:bg-ink-100",
        outline: "border surface hover:bg-[var(--surface-sunken)]",
        ghost: "hover:bg-[var(--surface-sunken)]",
        danger: "bg-red-600 text-white hover:bg-red-700",
        success: "bg-green-600 text-white hover:bg-green-700",
        lemon: "bg-lemon text-ink-800 hover:brightness-95 font-semibold",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-6 text-base",
        icon: "size-11 shrink-0",
        "icon-sm": "size-9 shrink-0",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { buttonVariants };
