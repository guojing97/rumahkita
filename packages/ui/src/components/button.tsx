import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      children,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium font-body rounded-btn transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-neo cursor-pointer';

    const variantStyles: Record<string, string> = {
      primary:
        'bg-primary text-ink border-neo border-ink shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-neo-active',
      secondary:
        'bg-surface text-ink border-neo border-ink shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-neo-active',
      destructive:
        'bg-danger text-white border-neo border-ink shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-neo-active',
      outline:
        'bg-transparent text-ink border-neo border-ink hover:bg-surface/50 active:translate-x-[1px] active:translate-y-[1px]',
      ghost:
        'bg-transparent text-ink border-transparent hover:bg-ink/5 active:bg-ink/10',
    };

    const sizeStyles: Record<string, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base font-semibold gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
