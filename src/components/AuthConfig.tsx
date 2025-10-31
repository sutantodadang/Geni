import React, { useState } from "react";
import { AuthConfig, AuthType } from "../store";
import { Eye, EyeOff, Lock, Key } from "lucide-react";

interface AuthConfigProps {
  auth?: AuthConfig;
  onAuthChange: (auth?: AuthConfig) => void;
  disabled?: boolean;
}

const AuthConfigComponent: React.FC<AuthConfigProps> = ({
  auth,
  onAuthChange,
  disabled = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const handleAuthTypeChange = (type: AuthType) => {
    if (type === "none") {
      onAuthChange(undefined);
    } else {
      if (type === "basic") {
        onAuthChange({
          type,
          basic: { username: "", password: "" },
        });
      } else if (type === "bearer") {
        onAuthChange({
          type,
          bearer: { token: "" },
        });
      } else {
        onAuthChange({ type });
      }
    }
  };

  const handleBasicAuthChange = (
    field: "username" | "password",
    value: string,
  ) => {
    if (!auth || auth.type !== "basic") return;

    onAuthChange({
      ...auth,
      basic: {
        username: auth.basic?.username || "",
        password: auth.basic?.password || "",
        [field]: value,
      },
    });
  };

  const handleBearerTokenChange = (token: string) => {
    if (!auth || auth.type !== "bearer") return;

    onAuthChange({
      ...auth,
      bearer: { token },
    });
  };

  const currentType = auth?.type || "none";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Authentication Type
        </label>
        <select
          value={currentType}
          onChange={(e) => handleAuthTypeChange(e.target.value as AuthType)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="none">No Authentication</option>
          <option value="basic">Basic Authentication</option>
          <option value="bearer">Bearer Token</option>
        </select>
      </div>

      {currentType === "basic" && auth?.basic && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Lock className="h-4 w-4" />
            <span>Basic Authentication</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={auth.basic.username}
              onChange={(e) =>
                handleBasicAuthChange("username", e.target.value)
              }
              disabled={disabled}
              placeholder="Enter username"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={auth.basic.password}
                onChange={(e) =>
                  handleBasicAuthChange("password", e.target.value)
                }
                disabled={disabled}
                placeholder="Enter password"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={disabled}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Basic authentication will automatically add an Authorization header
            with base64 encoded credentials.
          </div>
        </div>
      )}

      {currentType === "bearer" && auth?.bearer && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Key className="h-4 w-4" />
            <span>Bearer Token</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={auth.bearer.token}
                onChange={(e) => handleBearerTokenChange(e.target.value)}
                disabled={disabled}
                placeholder="Enter bearer token"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                disabled={disabled}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Bearer token will automatically add an Authorization header with the
            provided token.
          </div>
        </div>
      )}

      {currentType === "none" && (
        <div className="p-4 bg-gray-50 rounded-lg border text-sm text-gray-600">
          No authentication will be applied to requests in this collection.
        </div>
      )}
    </div>
  );
};

export default AuthConfigComponent;
