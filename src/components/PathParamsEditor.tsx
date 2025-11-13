import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle } from "lucide-react";

interface PathParamRow {
  key: string;
  value: string;
  enabled: boolean;
}

interface PathParamsEditorProps {
  url: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

const PathParamsEditor: React.FC<PathParamsEditorProps> = ({
  url,
  value,
  onChange,
}) => {
  const [detectedParams, setDetectedParams] = useState<string[]>([]);
  const [rows, setRows] = useState<PathParamRow[]>([]);

  // Extract path params from URL when URL changes
  useEffect(() => {
    const extractParams = async () => {
      try {
        const params = await invoke<string[]>("extract_path_params", { url });
        setDetectedParams(params);

        // Initialize rows from detected params
        const newRows: PathParamRow[] = params.map((param) => ({
          key: param,
          value: value[param] || "",
          enabled: true,
        }));

        setRows(newRows);
      } catch (error) {
        console.error("Failed to extract path params:", error);
        setDetectedParams([]);
        setRows([]);
      }
    };

    extractParams();
  }, [url]);

  // Update rows when value changes externally
  useEffect(() => {
    if (detectedParams.length > 0) {
      setRows((prevRows) =>
        detectedParams.map((param) => {
          const existingRow = prevRows.find((r) => r.key === param);
          return {
            key: param,
            value: value[param] || existingRow?.value || "",
            enabled: existingRow?.enabled ?? true,
          };
        })
      );
    }
  }, [value, detectedParams]);

  const updateParent = (newRows: PathParamRow[]) => {
    const newValue: Record<string, string> = {};
    newRows.forEach((row) => {
      if (row.enabled && row.key.trim()) {
        newValue[row.key] = row.value;
      }
    });
    onChange(newValue);
  };

  const updateRow = (index: number, updates: Partial<PathParamRow>) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], ...updates };
    setRows(newRows);
    updateParent(newRows);
  };

  const toggleRowEnabled = (index: number) => {
    const newRows = [...rows];
    newRows[index].enabled = !newRows[index].enabled;
    setRows(newRows);
    updateParent(newRows);
  };

  const getUrlPreview = () => {
    let preview = url;
    rows.forEach((row) => {
      if (row.enabled && row.value) {
        preview = preview.replace(`:${row.key}`, row.value);
      }
    });
    return preview;
  };

  if (detectedParams.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          No path parameters detected. Use{" "}
          <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
            :param_name
          </code>{" "}
          syntax in your URL.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-2">
          Example:{" "}
          <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
            http://api.example.com/users/:user_id/posts/:post_id
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
          <span>Path Parameters</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            {detectedParams.length} detected
          </span>
        </h4>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className={`flex items-center space-x-2 p-2 rounded-md border ${
              row.enabled
                ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                : "bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700"
            }`}
          >
            {/* Enabled Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={() => toggleRowEnabled(index)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded p-1"
              />
            </div>

            {/* Parameter Name (readonly, detected from URL) */}
            <div className="flex-1 min-w-0">
              <div className="relative">
                <input
                  type="text"
                  value={row.key}
                  readOnly
                  className="w-full form-input text-sm bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed p-1"
                  title="Parameter name is detected from URL"
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                  :{row.key}
                </span>
              </div>
            </div>

            {/* Value Input */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={row.value}
                onChange={(e) => updateRow(index, { value: e.target.value })}
                className="w-full form-input text-sm p-1"
                placeholder={`Value for :${row.key}`}
                disabled={!row.enabled}
              />
            </div>
          </div>
        ))}
      </div>

      {/* URL Preview */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
              URL Preview:
            </p>
            <code className="text-xs text-blue-700 dark:text-blue-300 break-all block">
              {getUrlPreview()}
            </code>
          </div>
        </div>
      </div>

      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <strong>Path Parameters</strong> are automatically detected from your
          URL using the{" "}
          <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">
            :parameter
          </code>{" "}
          syntax. They will be replaced with the values you provide before
          sending the request. Environment variables like{" "}
          <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">
            {"{{variable}}"}
          </code>{" "}
          are also supported in values.
        </p>
      </div>
    </div>
  );
};

export default PathParamsEditor;
