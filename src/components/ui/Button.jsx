import React from 'react';
import { motion } from 'framer-motion';

const Button = React.forwardRef(({
  children,
  onClick,
  variant = 'primary',
  className = '',
  icon: Icon,
  ...props
}, ref) => {
  const baseStyle = "relative flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold shadow-sm transition-all duration-300 ease-smooth disabled:opacity-50";
  const variantStyles = {
    primary: "bg-primary text-on-primary hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/50",
    secondary: "bg-surface text-text-primary hover:bg-surface/80 border border-primary/20",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${baseStyle} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5 mr-2" />}
      {children}
    </motion.button>
  );
});

export default Button;