import React, { useState, useEffect } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";

interface QueryParamRow {
  key: string;
  value: string;
  enabled: boolean;
}

interface QueryParamsEditorProps {
  url: string;
  onUrlChange: (url: string) => void;
}

const QueryParamsEditor: React.FC<QueryParamsEditorProps> = ({
  url,
  onUrlChange,
}) => {
  const [rows, setRows] = useState<QueryParamRow[]>([]);

  // Parse query params from URL
  const parseUrlParams = (urlString: string): Record<string, string> => {
    const params: Record<string, string> = {};
    try {
      // Handle relative URLs by adding a dummy base
      const urlToParse = urlString.startsWith('http') 
        ? urlString 
        : `http://dummy.com${urlString.startsWith('/') ? '' : '/'}${urlString}`;
      
      const urlObj = new URL(urlToParse);
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
    } catch {
      // Invalid URL, try manual parsing for edge cases
      if (urlString.includes('?')) {
          const queryString = urlString.split('?')[1];
          if (queryString) {
              const pairs = queryString.split('&');
              pairs.forEach(pair => {
                  const [key, value] = pair.split('=');
                  if (key) {
                      params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : "";
                  }
              });
          }
      }
    }
    return params;
  };

  // Initialize rows from URL
  useEffect(() => {
    const params = parseUrlParams(url);
    const paramRows: QueryParamRow[] = Object.entries(params).map(
      ([key, value]) => ({
        key,
        value,
        enabled: true,
      })
    );

    // Add an empty row if no params exist
    if (paramRows.length === 0) {
      paramRows.push({ key: "", value: "", enabled: true });
    }

    setRows(paramRows);
  }, [url]);

  // Update URL from rows
  const updateUrl = (newRows: QueryParamRow[]) => {
    try {
      // Handle relative URLs
      const isRelative = !url.startsWith('http');
      const urlToParse = isRelative
        ? `http://dummy.com${url.startsWith('/') ? '' : '/'}${url}`
        : url;

      const urlObj = new URL(urlToParse);
      // Clear existing params
      urlObj.search = "";

      // Add enabled params with non-empty keys
      newRows.forEach((row) => {
        if (row.enabled && row.key.trim()) {
          urlObj.searchParams.set(row.key, row.value);
        }
      });

      // Return the path + search if it was relative
      if (isRelative) {
          const path = urlObj.pathname;
          const search = urlObj.search;
          onUrlChange(`${path}${search}`);
      } else {
          onUrlChange(urlObj.toString());
      }
    } catch {
      // Invalid URL, don't update
    }
  };

  const addRow = () => {
    const newRows = [...rows, { key: "", value: "", enabled: true }];
    setRows(newRows);
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    updateUrl(newRows);
  };

  const updateRow = (index: number, updates: Partial<QueryParamRow>) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], ...updates };
    setRows(newRows);
    updateUrl(newRows);
  };

  const toggleRowEnabled = (index: number) => {
    const newRows = [...rows];
    newRows[index].enabled = !newRows[index].enabled;
    setRows(newRows);
    updateUrl(newRows);
  };

  const getUrlPreview = () => {
    try {
      const isRelative = !url.startsWith('http');
      const urlToParse = isRelative
        ? `http://dummy.com${url.startsWith('/') ? '' : '/'}${url}`
        : url;

      const urlObj = new URL(urlToParse);
      urlObj.search = "";

      rows.forEach((row) => {
        if (row.enabled && row.key.trim()) {
          urlObj.searchParams.set(row.key, row.value);
        }
      });

      return isRelative ? `${urlObj.pathname}${urlObj.search}` : urlObj.toString();
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
          <span>Query Parameters</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            {rows.filter((r) => r.enabled && r.key.trim()).length} active
          </span>
        </h4>
        <button
          onClick={addRow}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
        >
          <Plus className="h-3 w-3" />
          <span>Add Parameter</span>
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
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

            {/* Key Input */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={row.key}
                onChange={(e) => updateRow(index, { key: e.target.value })}
                className="w-full form-input text-sm p-1"
                placeholder="Parameter name"
                disabled={!row.enabled}
              />
            </div>

            {/* Value Input */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={row.value}
                onChange={(e) => updateRow(index, { value: e.target.value })}
                className="w-full form-input text-sm p-1"
                placeholder="Parameter value"
                disabled={!row.enabled}
              />
            </div>

            {/* Delete Button */}
            <button
              onClick={() => removeRow(index)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
              title="Remove parameter"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            No query parameters added yet. Click "Add Parameter" to start.
          </p>
        </div>
      )}

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
          <strong>Query Parameters</strong> are automatically synced with your
          URL. Changes here will update the URL and vice versa. Environment
          variables like{" "}
          <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">
            {"{{variable}}"}
          </code>{" "}
          are supported in both keys and values.
        </p>
      </div>
    </div>
  );
};

export default QueryParamsEditor;
