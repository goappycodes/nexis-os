import * as React from "react";
import { cn } from "@/lib/utils";

const fieldStyles =
  "w-full rounded-xl border bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm outline-none transition " +
  "placeholder:text-[var(--text-muted)] focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldStyles, "min-h-11", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldStyles, "min-h-24 resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldStyles, "min-h-11 appearance-none pr-9", className)} {...props} />
));
Select.displayName = "Select";

export function Label({
  className,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium", className)} {...props}>
      {props.children}
      {required && <span className="ml-0.5 text-pink-500">*</span>}
    </label>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="muted mt-1.5 text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
