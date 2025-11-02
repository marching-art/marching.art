import React from 'react';

const TextInput = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <div className="w-full">
    <label className="block text-sm font-medium text-text-secondary mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-300"
    />
  </div>
);

export default TextInput;