import React, { useEffect } from "react";
import { CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";
import { ToastMessage } from "../contexts/ToastContext";

interface ToastProps {
  message: ToastMessage;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ message, onRemove }) => {
  useEffect(() => {
    const duration = message.duration || 3000;
    const timer = setTimeout(() => {
      onRemove(message.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [message.id, message.duration, onRemove]);

  const getIcon = () => {
    switch (message.type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "info":
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (message.type) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-yellow-50 border-yellow-200";
      case "info":
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <div
      className={`flex items-center p-4 mb-3 rounded-lg border ${getBgColor()} shadow-md animate-in slide-in-from-right-full duration-300 ease-out`}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <div className="ml-3 flex-1">
        <p className="text-sm font-medium text-gray-900">{message.message}</p>
      </div>
      <button
        onClick={() => onRemove(message.id)}
        className="ml-4 text-gray-400 hover:text-gray-600"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  messages: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  messages,
  onRemove,
}) => {
  if (messages.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      {messages.map((message) => (
        <Toast key={message.id} message={message} onRemove={onRemove} />
      ))}
    </div>
  );
};

export { useToast } from "../contexts/ToastContext";

export default Toast;
