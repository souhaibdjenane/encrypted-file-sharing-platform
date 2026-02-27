import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={id} className="text-sm font-medium text-vs-text">
                    {label}
                </label>
            )}
            <input
                id={id}
                className={`
          w-full rounded-lg px-4 py-2.5 text-sm outline-none
          bg-vs-bg
          text-vs-text
          placeholder:text-vs-text-subtle
          border transition-colors duration-150
          focus:ring-1 focus:ring-vs-primary focus:border-vs-primary
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error
                        ? 'border-vs-danger'
                        : 'border-vs-border'
                    }
          ${className}
        `}
                {...props}
            />
            {error && <p className="text-xs text-vs-danger">{error}</p>}
        </div>
    )
}
