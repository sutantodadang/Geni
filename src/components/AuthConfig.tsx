import React, { useState } from "react";
import { AuthConfig, AuthType } from "../store";
import { Eye, EyeOff, Lock, Key } from "lucide-react";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Label } from "./ui/Label";

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

  const authTypeOptions = [
    { value: "none", label: "No Authentication" },
    { value: "basic", label: "Basic Authentication" },
    { value: "bearer", label: "Bearer Token" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Select
          label="Authentication Type"
          value={currentType}
          onChange={(e) => handleAuthTypeChange(e.target.value as AuthType)}
          disabled={disabled}
          options={authTypeOptions}
        />
      </div>

      {currentType === "basic" && auth?.basic && (
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <Lock className="h-4 w-4" />
            <span>Basic Authentication</span>
          </div>

          <Input
            label="Username"
            type="text"
            value={auth.basic.username}
            onChange={(e) => handleBasicAuthChange("username", e.target.value)}
            disabled={disabled}
            placeholder="Enter username"
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={auth.basic.password}
              onChange={(e) => handleBasicAuthChange("password", e.target.value)}
              disabled={disabled}
              placeholder="Enter password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={disabled}
              className="absolute top-8 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:cursor-not-allowed"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Basic authentication will automatically add an Authorization header
            with base64 encoded credentials.
          </div>
        </div>
      )}

      {currentType === "bearer" && auth?.bearer && (
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
            <Key className="h-4 w-4" />
            <span>Bearer Token</span>
          </div>

          <div className="relative">
            <Input
              label="Token"
              type={showToken ? "text" : "password"}
              value={auth.bearer.token}
              onChange={(e) => handleBearerTokenChange(e.target.value)}
              disabled={disabled}
              placeholder="Enter bearer token"
              className="pr-10"
              error={
                auth.bearer.token && auth.bearer.token.trim().includes(" ")
                  ? "Bearer tokens typically do not contain spaces"
                  : undefined
              }
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              disabled={disabled}
              className="absolute top-8 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:cursor-not-allowed"
            >
              {showToken ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Bearer token will automatically add an Authorization header with the
            provided token.
          </div>
        </div>
      )}

      {currentType === "none" && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
          No authentication will be applied to requests in this collection.
        </div>
      )}
    </div>
  );
};


export default AuthConfigComponent;
