import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends HTMLMotionProps<"button"> {
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
  const baseStyles = "rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-tight";
  
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2",
    lg: "px-6 py-2.5 text-base"
  };

  const variants = {
    // Technical Indigo
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm border border-transparent focus:ring-indigo-500",
    // Architectural White
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm",
    // Alert Red
    danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 shadow-sm",
    // Ghost
    ghost: "bg-transparent text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50"
  };

  return (
    <motion.button 
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-medium">Processing</span>
        </>
      ) : children}
    </motion.button>
  );
};