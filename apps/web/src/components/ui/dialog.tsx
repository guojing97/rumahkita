'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@rumahkita/ui';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  maxWidth = 'lg',
}: DialogProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Lock background scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!mounted || !open) return null;

  const maxWidthClass = {
    sm: 'md:max-w-sm',
    md: 'md:max-w-md',
    lg: 'md:max-w-lg',
    xl: 'md:max-w-xl',
    '2xl': 'md:max-w-2xl',
  }[maxWidth];

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={() => onOpenChange(false)}
      />

      {/* Responsive Sheet/Modal */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-50 w-full bg-surface border-ink shadow-neo-lg transition-transform duration-200 ease-out',
          // Mobile: Bottom Sheet
          'rounded-t-2xl border-t-neo-thick border-x-neo-thick p-5 max-h-[90dvh] overflow-y-auto pb-8',
          // Desktop: Centered Modal
          'md:rounded-modal md:border-neo-thick md:p-6 md:max-h-[85vh] md:pb-6',
          maxWidthClass,
          className
        )}
      >
        {/* Mobile drag handle indicator */}
        <div className="md:hidden w-12 h-1.5 bg-ink/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-ink/15">
          <div>
            <h3 className="font-heading font-bold text-xl text-ink leading-tight">{title}</h3>
            {description && <p className="text-xs text-muted font-body mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Tutup dialog"
            className="rounded-btn p-1.5 text-muted hover:text-ink hover:bg-bg border border-transparent hover:border-ink focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div>{children}</div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
