import * as React from 'react';
import { cn } from '../lib/utils.js';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevated = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface border-neo border-ink rounded-card text-ink p-4 sm:p-6 transition-all duration-150',
        elevated && 'shadow-neo',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-heading font-bold text-xl leading-none tracking-tight text-ink', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted font-body', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('font-body', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center pt-4 border-t border-ink/10', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  badge?: React.ReactNode;
}

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, icon, description, badge, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface border-neo border-ink rounded-card shadow-neo p-4 sm:p-5 flex flex-col justify-between text-ink',
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-muted font-body">{title}</span>
        {icon && <div className="p-1.5 rounded-btn bg-bg border border-ink/20 text-ink">{icon}</div>}
      </div>
      <div>
        <div className="font-heading font-bold text-xl sm:text-2xl lg:text-3xl tracking-tight tabular-nums text-ink break-words leading-tight">
          {value}
        </div>
        {(description || badge) && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
            {badge && <span className="shrink-0 inline-flex">{badge}</span>}
            {description && <span className="text-xs text-muted font-body">{description}</span>}
          </div>
        )}
      </div>
    </div>
  )
);
StatCard.displayName = 'StatCard';
