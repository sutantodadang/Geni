import React, { useState } from "react";
import { Plus, Trash2, Upload, File } from "lucide-react";
import { FormDataField } from "../store";

interface FormDataRow {
  key: string;
  field: FormDataField;
  enabled: boolean;
}

interface FormDataEditorProps {
  value: Record<string, FormDataField>;
  onChange: (value: Record<string, FormDataField>) => void;
}

const FormDataEditor: React.FC<FormDataEditorProps> = ({ value, onChange }) => {
  // Convert Record to array for easier manipulation
  const rowsFromValue = (): FormDataRow[] => {
    return Object.entries(value).map(([key, field]) => ({
      key,
      field,
      enabled: true,
    }));
  };

  const [rows, setRows] = useState<FormDataRow[]>(() => {
    const initial = rowsFromValue();
    return initial.length > 0
      ? initial
      : [{ key: "", field: { Text: { value: "" } }, enabled: true }];
  });

  const updateParent = (newRows: FormDataRow[]) => {
    const newValue: Record<string, FormDataField> = {};
    newRows.forEach((row) => {
      if (row.enabled && row.key.trim()) {
        newValue[row.key] = row.field;
      }
    });
    onChange(newValue);
  };

  const addRow = () => {
    const newRows = [
      ...rows,
      { key: "", field: { Text: { value: "" } }, enabled: true },
    ];
    setRows(newRows);
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    updateParent(newRows);
  };

  const updateRow = (index: number, updates: Partial<FormDataRow>) => {
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

  const handleFileSelect = (index: number) => {
    // Create a hidden file input
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];

      if (file) {
        // In Tauri, we get the file path
        // For web compatibility, we use the file name
        const filePath = (file as any).path || file.name;
        updateRow(index, {
          field: { File: { path: filePath } },
        });
      }

      document.body.removeChild(input);
    };

    input.oncancel = () => {
      document.body.removeChild(input);
    };

    document.body.appendChild(input);
    input.click();
  };

  const getFieldValue = (field: FormDataField): string => {
    if ("Text" in field) {
      return field.Text.value;
    } else if ("File" in field) {
      return field.File.path;
    }
    return "";
  };

  const getFieldType = (field: FormDataField): "text" | "file" => {
    return "Text" in field ? "text" : "file";
  };

  const getFileName = (path: string): string => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Form Data
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
        <div className="space-y-2 items-center">
          {rows.map((row, index) => (
            <div
              key={index}
              className={`flex items-center space-x-2 p-2 rounded-md border justify-between ${
                row.enabled
                  ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                  : "bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700"
              }`}
            >
              {/* Enabled Checkbox */}
              <div>
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
                  placeholder="Field name"
                  disabled={!row.enabled}
                />
              </div>

              {/* Type Selector */}
              <div className="w-24">
                <select
                  value={getFieldType(row.field)}
                  onChange={(e) => {
                    const newType = e.target.value as "text" | "file";
                    if (newType === "text") {
                      updateRow(index, { field: { Text: { value: "" } } });
                    } else {
                      updateRow(index, { field: { File: { path: "" } } });
                    }
                  }}
                  className="w-full form-input text-sm p-1"
                  disabled={!row.enabled}
                >
                  <option value="text">Text</option>
                  <option value="file">File</option>
                </select>
              </div>

              {/* Value Input */}
              <div className="flex-1 min-w-0">
                {getFieldType(row.field) === "text" ? (
                  <input
                    type="text"
                    value={getFieldValue(row.field)}
                    onChange={(e) =>
                      updateRow(index, {
                        field: { Text: { value: e.target.value } },
                      })
                    }
                    className="w-full form-input text-sm p-1"
                    placeholder="Field value"
                    disabled={!row.enabled}
                  />
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm">
                      <File className="h-4 w-4 text-gray-400" />
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                        {getFieldValue(row.field)
                          ? getFileName(getFieldValue(row.field))
                          : "No file selected"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleFileSelect(index)}
                      disabled={!row.enabled}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded-md flex items-center space-x-1"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Browse</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Delete Button */}
              <button
                onClick={() => removeRow(index)}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                title="Remove field"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Tip:</strong> Use checkboxes to temporarily disable fields
          without removing them. Text fields support environment variables like{" "}
          <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/40 rounded">
            {"{{variable}}"}
          </code>
          .
        </p>
      </div>
    </div>
  );
};

export default FormDataEditor;
