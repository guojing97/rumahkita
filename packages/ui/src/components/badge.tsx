import * as React from 'react';
import { Check, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils.js';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'aman' | 'menipis' | 'habis' | 'overdue' | 'primary' | 'secondary' | 'neutral';
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', icon, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-badge border-neo border-ink text-xs font-medium font-body select-none';

    const variantStyles: Record<string, string> = {
      aman: 'bg-[#D1FAE5] text-[#065F46] border-[#065F46] font-semibold',
      menipis: 'bg-[#FEF3C7] text-[#92400E] border-[#92400E] font-semibold',
      habis: 'bg-[#FEE2E2] text-[#991B1B] border-[#991B1B] font-semibold',
      overdue: 'bg-[#FEE2E2] text-[#991B1B] border-[#991B1B] font-semibold',
      primary: 'bg-primary text-ink border-ink font-semibold',
      secondary: 'bg-secondary text-ink border-ink',
      neutral: 'bg-surface text-ink border-ink',
    };

    // Default icon per semantic variant if none supplied
    let defaultIcon: React.ReactNode = null;
    if (variant === 'aman') defaultIcon = <Check className="w-3.5 h-3.5 shrink-0" />;
    if (variant === 'menipis') defaultIcon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
    if (variant === 'habis') defaultIcon = <XCircle className="w-3.5 h-3.5 shrink-0" />;
    if (variant === 'overdue') defaultIcon = <Clock className="w-3.5 h-3.5 shrink-0" />;

    const renderIcon = icon !== undefined ? icon : defaultIcon;

    return (
      <span ref={ref} className={cn(baseStyles, variantStyles[variant], className)} {...props}>
        {renderIcon}
        <span>{children}</span>
      </span>
    );
  }
);
Badge.displayName = 'Badge';
