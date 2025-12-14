import React, { forwardRef, useId } from 'react';
import { LucideIcon } from 'lucide-react';

// =============================================================================
// INPUT COMPONENT
// =============================================================================

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  rightElement?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'px-3 py-2 text-sm min-h-[36px]',
  md: 'px-4 py-3 text-base min-h-[44px]',
  lg: 'px-5 py-4 text-lg min-h-[52px]',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      rightElement,
      inputSize = 'md',
      className = '',
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-cream/70 mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {LeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/50">
              <LeftIcon className={iconSizes[inputSize]} />
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={`
              w-full rounded-lg
              bg-black/30 border
              text-cream placeholder-cream/40
              transition-all duration-300
              focus:outline-none focus:border-gold-500/50 focus:shadow-[0_0_15px_rgba(250,204,21,0.15)]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${hasError
                ? 'border-red-500/50 focus:border-red-500'
                : 'border-white/15 hover:border-white/25'
              }
              ${sizeStyles[inputSize]}
              ${LeftIcon ? 'pl-10' : ''}
              ${RightIcon || rightElement ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />
          {(RightIcon || rightElement) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/50">
              {rightElement || (RightIcon && <RightIcon className={iconSizes[inputSize]} />)}
            </div>
          )}
        </div>
        {(helperText || error) && (
          <p
            className={`mt-1.5 text-sm ${hasError ? 'text-red-400' : 'text-cream/50'}`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// =============================================================================
// TEXTAREA COMPONENT
// =============================================================================

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, className = '', id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-cream/70 mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={`
            w-full px-4 py-3 rounded-lg min-h-[120px] resize-none
            bg-black/30 border
            text-cream placeholder-cream/40
            transition-all duration-300
            focus:outline-none focus:border-gold-500/50 focus:shadow-[0_0_15px_rgba(250,204,21,0.15)]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${hasError
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-white/15 hover:border-white/25'
            }
            ${className}
          `}
          {...props}
        />
        {(helperText || error) && (
          <p
            className={`mt-1.5 text-sm ${hasError ? 'text-red-400' : 'text-cream/50'}`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// =============================================================================
// SELECT COMPONENT
// =============================================================================

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  selectSize?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      options,
      placeholder,
      selectSize = 'md',
      className = '',
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-cream/70 mb-2"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={`
            w-full rounded-lg appearance-none cursor-pointer
            bg-black/30 border
            text-cream
            transition-all duration-300
            focus:outline-none focus:border-gold-500/50 focus:shadow-[0_0_15px_rgba(250,204,21,0.15)]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${hasError
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-white/15 hover:border-white/25'
            }
            ${sizeStyles[selectSize]}
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {(helperText || error) && (
          <p
            className={`mt-1.5 text-sm ${hasError ? 'text-red-400' : 'text-cream/50'}`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Input;
