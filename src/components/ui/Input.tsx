import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from './Button'; // Re-use cn

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="w-full space-y-2">
                {label && (
                    <label className="text-sm font-bold text-foreground/80">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        'flex h-11 w-full rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                        error ? 'border-red-500 focus-visible:ring-red-500' : 'border-border',
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p className="text-sm text-red-500 font-medium">{error}</p>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';

export { Input };
