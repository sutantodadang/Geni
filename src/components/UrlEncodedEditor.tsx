import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface UrlEncodedRow {
  key: string;
  value: string;
  enabled: boolean;
}

interface UrlEncodedEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

const UrlEncodedEditor: React.FC<UrlEncodedEditorProps> = ({
  value,
  onChange,
}) => {
  // Convert Record to array for easier manipulation
  const rowsFromValue = (): UrlEncodedRow[] => {
    return Object.entries(value).map(([key, val]) => ({
      key,
      value: val,
      enabled: true,
    }));
  };

  const [rows, setRows] = useState<UrlEncodedRow[]>(() => {
    const initial = rowsFromValue();
    return initial.length > 0
      ? initial
      : [{ key: "", value: "", enabled: true }];
  });

  const updateParent = (newRows: UrlEncodedRow[]) => {
    const newValue: Record<string, string> = {};
    newRows.forEach((row) => {
      if (row.enabled && row.key.trim()) {
        newValue[row.key] = row.value;
      }
    });
    onChange(newValue);
  };

  const addRow = () => {
    const newRows = [...rows, { key: "", value: "", enabled: true }];
    setRows(newRows);
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    updateParent(newRows);
  };

  const updateRow = (index: number, updates: Partial<UrlEncodedRow>) => {
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          URL Encoded Form Data
        </h4>
        <button
          onClick={addRow}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
        >
          <Plus className="h-3 w-3" />
          <span>Add Field</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            No form fields added yet. Click "Add Field" to start.
          </p>
        </div>
      ) : (
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
                  className="form-checkbox h-4 w-4 text-blue-600 rounded"
                />
              </div>

              {/* Key Input */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => updateRow(index, { key: e.target.value })}
                  className="w-full form-input text-sm p-1"
                  placeholder="Key"
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
                  placeholder="Value"
                  disabled={!row.enabled}
                />
              </div>

              {/* Delete Button */}
              <button
                onClick={() => removeRow(index)}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-2"
                title="Remove field"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <strong>Note:</strong> URL-encoded data only supports text values (no
          file uploads). Use <strong>Form Data</strong> for file uploads.
          Environment variables like{" "}
          <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">
            {"{{variable}}"}
          </code>{" "}
          are supported.
        </p>
      </div>
    </div>
  );
};

export default UrlEncodedEditor;
