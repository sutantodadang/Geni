import React from "react";

interface DropIndicatorProps {
  isActive: boolean;
  type: "collection" | "request" | "root";
  message?: string;
  className?: string;
}

const DropIndicator: React.FC<DropIndicatorProps> = ({
  isActive,
  type,
  message,
  className = "",
}) => {
  if (!isActive) return null;

  const getIndicatorStyles = () => {
    const baseStyles = "absolute inset-0 rounded-md border-2 border-dashed pointer-events-none z-10 transition-all duration-300";

    switch (type) {
      case "collection":
        return `${baseStyles} border-blue-400 bg-blue-50/80 backdrop-blur-sm`;
      case "request":
        return `${baseStyles} border-green-400 bg-green-50/80 backdrop-blur-sm`;
      case "root":
        return `${baseStyles} border-indigo-400 bg-indigo-50/80 backdrop-blur-sm`;
      default:
        return `${baseStyles} border-gray-400 bg-gray-50/80 backdrop-blur-sm`;
    }
  };

  const getIcon = () => {
    switch (type) {
      case "collection":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z"
            />
          </svg>
        );
      case "request":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case "root":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7zm0 0V5a2 2 0 012-2h6l2 2h6a2 2 0 012 2v2"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getMessage = () => {
    if (message) return message;

    switch (type) {
      case "collection":
        return "Drop here to add to collection";
      case "request":
        return "Drop request here";
      case "root":
        return "Drop here to move to root";
      default:
        return "Drop zone";
    }
  };

  const getTextColor = () => {
    switch (type) {
      case "collection":
        return "text-blue-600";
      case "request":
        return "text-green-600";
      case "root":
        return "text-indigo-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className={`${getIndicatorStyles()} ${className}`}>
      {/* Animated background pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='0.1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E")`,
          animation: "slide-bg 2s linear infinite",
        }}
      />

      {/* Drop indicator content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`flex items-center space-x-2 px-4 py-2 bg-white/90 rounded-lg shadow-sm border ${getTextColor()}`}>
          <div className={`${getTextColor()} animate-bounce`}>
            {getIcon()}
          </div>
          <span className={`text-sm font-medium ${getTextColor()}`}>
            {getMessage()}
          </span>
        </div>
      </div>

      {/* Pulsing border effect */}
      <div
        className="absolute inset-0 rounded-md border-2 border-current opacity-50"
        style={{
          animation: "pulse-border 1.5s ease-in-out infinite",
        }}
      />
    </div>
  );
};

export default DropIndicator;
