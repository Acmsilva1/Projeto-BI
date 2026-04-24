import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactElement } from "react";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-slate-950 hover:brightness-110",
        ghost: "bg-transparent text-[var(--app-fg)] hover:bg-[color-mix(in_srgb,var(--app-elevated)_70%,transparent)]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, ...props }: ButtonProps): ReactElement {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
