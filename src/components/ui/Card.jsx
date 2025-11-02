import React from 'react';

const Card = ({ children, className = '' }) => {
  return (
    <div className={`bg-surface rounded-xl shadow-lg border border-primary/10 overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

export default Card;