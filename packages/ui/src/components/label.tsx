import * as React from 'react';
import { cn } from '../lib/utils.js';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'block text-sm font-medium font-body text-ink mb-1.5 select-none',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-danger ml-1 font-bold">*</span>}
    </label>
  )
);
Label.displayName = 'Label';
