import React, { useRef } from "react";

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const UrlInput: React.FC<UrlInputProps> = ({
  value,
  onChange,
  placeholder = "https://api.example.com/endpoint",
  className = "",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Sync scroll position between input and highlight layer
  const handleScroll = () => {
    if (inputRef.current && highlightRef.current) {
      highlightRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  // Parse the URL to highlight environment variables
  const renderHighlightedContent = () => {
    if (!value) {
      return <span className="opacity-0">_</span>;
    }

    // Regex to match {{variable_name}}
    const regex = /(\{\{[^}]+\}\})/g;
    const parts = value.split(regex);

    return (
      <>
        {parts.map((part, index) => {
          if (part.match(regex)) {
            // This is an environment variable - show with background
            return (
              <span
                key={index}
                className="bg-blue-200/80 dark:bg-blue-600/60 text-blue-900 dark:text-blue-100 rounded px-0.5"
              >
                {part}
              </span>
            );
          }
          // Regular text - make it invisible but preserve space
          return (
            <span key={index} className="opacity-0">
              {part}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Highlighted background layer */}
      <div
        ref={highlightRef}
        className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden"
        style={{
          padding: "0.5rem",
          fontSize: "0.875rem",
          lineHeight: "1.25rem",
          whiteSpace: "pre",
          wordBreak: "keep-all",
        }}
      >
        {renderHighlightedContent()}
      </div>

      {/* Actual input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        className="form-input p-2 relative w-full"
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          fontSize: "0.875rem",
          lineHeight: "1.25rem",
        }}
      />
    </div>
  );
};

export default UrlInput;
