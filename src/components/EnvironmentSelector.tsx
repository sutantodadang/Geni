import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Globe, Settings, Plus } from "lucide-react";

export interface EnvironmentSelectorProps {
  activeEnvironment: { id: string; name: string } | null;
  environments: Array<{ id: string; name: string }>;
  onChange: (environmentId: string | null) => void;
  onManageEnvironments: () => void;
  onNewEnvironment: () => void;
  className?: string;
  disabled?: boolean;
}

const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  activeEnvironment,
  environments,
  onChange,
  onManageEnvironments,
  onNewEnvironment,
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

  const handleEnvironmentSelect = (environmentId: string | null) => {
    onChange(environmentId);
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

  const displayText = activeEnvironment
    ? activeEnvironment.name
    : "No Environment";

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Environment
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onManageEnvironments}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Manage environments"
          >
            <Settings className="h-3 w-3" />
          </button>
          <button
            onClick={onNewEnvironment}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="New environment"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Selector */}
      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            w-full flex items-center justify-between px-3 py-2
            border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm
            bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none
            focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400
            disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
            transition-colors duration-150
            ${isOpen ? "ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400" : ""}
          `}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Environment selector, currently ${displayText}`}
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <Globe className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <span
              className={`truncate ${activeEnvironment ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
            >
              {displayText}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
            <div
              className="py-1"
              role="listbox"
              aria-label="Environment options"
            >
              {/* No Environment Option */}
              <button
                type="button"
                onClick={() => handleEnvironmentSelect(null)}
                className={`
                  w-full px-3 py-2 text-left flex items-center space-x-2
                  hover:bg-gray-100 dark:hover:bg-gray-600 focus:bg-gray-100 dark:focus:bg-gray-600 focus:outline-none
                  transition-colors duration-150
                  ${!activeEnvironment ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}
                `}
                role="option"
                aria-selected={!activeEnvironment}
              >
                <Globe className="h-4 w-4 text-gray-400" />
                <span className="flex-1 truncate">No Environment</span>
                {!activeEnvironment && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>

              {/* Environment Options */}
              {environments.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => handleEnvironmentSelect(env.id)}
                  className={`
                    w-full px-3 py-2 text-left flex items-center space-x-2
                    hover:bg-gray-100 dark:hover:bg-gray-600 focus:bg-gray-100 dark:focus:bg-gray-600 focus:outline-none
                    transition-colors duration-150
                    ${activeEnvironment?.id === env.id ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}
                  `}
                  role="option"
                  aria-selected={activeEnvironment?.id === env.id}
                >
                  <Globe className="h-4 w-4 text-gray-400" />
                  <span className="flex-1 truncate">{env.name}</span>
                  {activeEnvironment?.id === env.id && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnvironmentSelector;
