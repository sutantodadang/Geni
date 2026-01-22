import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import HttpMethodBadge from "./HttpMethodBadge";

export interface HttpMethodSelectorProps {
  value: string;
  onChange: (method: string) => void;
  className?: string;
  disabled?: boolean;
}

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

const HttpMethodSelector: React.FC<HttpMethodSelectorProps> = ({
  value,
  onChange,
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMethodSelect = (method: string) => {
    onChange(method);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(!isOpen);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          flex items-center justify-between w-28 px-2 py-2
          border border-gray-300 dark:border-gray-600 rounded-md shadow-sm
          bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none
          focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400
          disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed
          transition-all duration-150 hover:border-gray-400 dark:hover:border-gray-500
          text-gray-900 dark:text-gray-100
          ${isOpen ? "ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400" : ""}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`HTTP method selector, currently ${value}`}
      >
        <HttpMethodBadge
          method={value}
          size="sm"
          variant="minimal"
          className="flex-shrink-0"
        />
        <ChevronDown
          className={`h-3 w-3 text-gray-400 dark:text-gray-300 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
          <div
            className="py-1 max-h-60 overflow-auto custom-scrollbar"
            role="listbox"
            aria-label="HTTP Methods"
          >
            {HTTP_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => handleMethodSelect(method)}
                className={`
                  w-full px-3 py-2 text-left flex items-center
                  text-gray-900 dark:text-gray-100
                  hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none
                  transition-colors duration-150
                  ${value === method ? "bg-blue-50 dark:bg-blue-900/30" : ""}
                `}
                role="option"
                aria-selected={value === method}
              >
                <HttpMethodBadge method={method} size="sm" variant="minimal" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HttpMethodSelector;
