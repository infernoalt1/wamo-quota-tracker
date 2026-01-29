import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[#020202]";
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-4 text-base"
  };

  const variants = {
    // Indigo Glow
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] border border-indigo-400/20 hover:shadow-[0_0_25px_-5px_rgba(79,70,229,0.7)]",
    // Glassy White
    secondary: "bg-white/[0.05] text-gray-200 border border-white/10 hover:bg-white/[0.1] hover:text-white backdrop-blur-sm shadow-lg",
    // Red Glow
    danger: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40",
    // Minimal
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/[0.05]"
  };

  return (
    <button 
      className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${isLoading || disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </>
      ) : children}
    </button>
  );
};