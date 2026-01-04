// =============================================================================
// INPUT COMPONENTS - ESPN PRO DATA STYLE
// =============================================================================
// Dense, utilitarian form controls. No floating labels, no material design.
// Laws: bg-[#0a0a0a], border-[#333], focus:border-espn-blue, rounded-sm

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
  sm: 'px-2.5 py-1.5 text-sm h-8',
  md: 'px-3 py-2 text-sm h-9',
  lg: 'px-3.5 py-2.5 text-sm h-10',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-5 h-5',
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
            className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {LeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <LeftIcon className={iconSizes[inputSize]} />
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={`
              w-full rounded-sm
              bg-[#111] border
              text-white text-sm placeholder-gray-600
              transition-colors
              focus:outline-none focus:border-[#0057B8]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${hasError
                ? 'border-red-500 focus:border-red-500'
                : 'border-[#333] hover:border-[#444]'
              }
              ${sizeStyles[inputSize]}
              ${LeftIcon ? 'pl-8' : ''}
              ${RightIcon || rightElement ? 'pr-8' : ''}
              ${className}
            `}
            {...props}
          />
          {(RightIcon || rightElement) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              {rightElement || (RightIcon && <RightIcon className={iconSizes[inputSize]} />)}
            </div>
          )}
        </div>
        {(helperText || error) && (
          <p
            className={`mt-1 text-xs ${hasError ? 'text-red-400' : 'text-gray-500'}`}
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
            className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={`
            w-full px-3 py-2 rounded-sm min-h-[80px] resize-none
            bg-[#111] border
            text-white text-sm placeholder-gray-600
            transition-colors
            focus:outline-none focus:border-[#0057B8]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${hasError
              ? 'border-red-500 focus:border-red-500'
              : 'border-[#333] hover:border-[#444]'
            }
            ${className}
          `}
          {...props}
        />
        {(helperText || error) && (
          <p
            className={`mt-1 text-xs ${hasError ? 'text-red-400' : 'text-gray-500'}`}
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
            className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={`
            w-full rounded-sm appearance-none cursor-pointer
            bg-[#111] border
            text-white text-sm
            transition-colors
            focus:outline-none focus:border-[#0057B8]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${hasError
              ? 'border-red-500 focus:border-red-500'
              : 'border-[#333] hover:border-[#444]'
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
            className={`mt-1 text-xs ${hasError ? 'text-red-400' : 'text-gray-500'}`}
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
