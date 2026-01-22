import React, { LabelHTMLAttributes } from 'react';

export const Label: React.FC<LabelHTMLAttributes<HTMLLabelElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <label
      className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
};
