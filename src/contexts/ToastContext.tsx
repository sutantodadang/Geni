import React, { createContext, useContext, useState, ReactNode } from "react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

interface ToastContextType {
  messages: ToastMessage[];
  addToast: (type: ToastMessage["type"], message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addToast = (
    type: ToastMessage["type"],
    message: string,
    duration?: number
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newMessage: ToastMessage = {
      id,
      type,
      message,
      duration,
    };

    setMessages((prev) => [...prev, newMessage]);
  };

  const removeToast = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  const success = (message: string, duration?: number) =>
    addToast("success", message, duration);

  const error = (message: string, duration?: number) =>
    addToast("error", message, duration);

  const info = (message: string, duration?: number) =>
    addToast("info", message, duration);

  const warning = (message: string, duration?: number) =>
    addToast("warning", message, duration);

  const value: ToastContextType = {
    messages,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
