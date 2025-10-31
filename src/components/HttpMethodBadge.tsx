import React from "react";

export interface HttpMethodBadgeProps {
  method: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal";
  className?: string;
}

const HttpMethodBadge: React.FC<HttpMethodBadgeProps> = ({
  method,
  size = "sm",
  variant = "default",
  className = "",
}) => {
  const getMethodClass = (method: string) => {
    const baseMethod = method.toUpperCase();
    switch (baseMethod) {
      case "GET":
        return "method-get";
      case "POST":
        return "method-post";
      case "PUT":
        return "method-put";
      case "DELETE":
        return "method-delete";
      case "PATCH":
        return "method-patch";
      case "HEAD":
        return "method-head";
      case "OPTIONS":
        return "method-options";
      default:
        return "method-head"; // fallback to gray styling
    }
  };

  const getSizeStyles = (size: string) => {
    switch (size) {
      case "sm":
        return "px-1.5 py-0.5 text-xs";
      case "md":
        return "px-2.5 py-1 text-sm";
      case "lg":
        return "px-3 py-1.5 text-base";
      default:
        return "px-1.5 py-0.5 text-xs";
    }
  };

  const getVariantStyles = (variant: string) => {
    if (variant === "minimal") {
      return "border border-current/20";
    }
    return "";
  };

  const baseClasses =
    "method-badge inline-flex items-center font-mono font-medium rounded-full";
  const methodClass = getMethodClass(method);
  const sizeStyles = getSizeStyles(size);
  const variantStyles = getVariantStyles(variant);

  return (
    <span
      className={`${baseClasses} ${methodClass} ${sizeStyles} ${variantStyles} ${className}`}
    >
      {method.toUpperCase()}
    </span>
  );
};

export default HttpMethodBadge;
