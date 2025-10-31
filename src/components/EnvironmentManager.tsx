import React, { useState } from "react";
import { useAppStore } from "../store";
import { Environment } from "../store";
import {
  Globe,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";

interface EnvironmentManagerProps {
  onClose: () => void;
}

interface EnvironmentVariable {
  key: string;
  value: string;
}

const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({ onClose }) => {
  const {
    environments,
    activeEnvironment,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
  } = useAppStore();

  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showVariables, setShowVariables] = useState<Record<string, boolean>>(
    {},
  );
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formVariables, setFormVariables] = useState<EnvironmentVariable[]>([
    { key: "", value: "" },
  ]);

  const resetForm = () => {
    setFormName("");
    setFormVariables([{ key: "", value: "" }]);
    setEditingEnv(null);
    setShowNewForm(false);
  };

  const handleCreateEnvironment = async () => {
    if (!formName.trim()) return;

    const variables: Record<string, string> = {};
    formVariables.forEach(({ key, value }) => {
      if (key.trim() && value.trim()) {
        variables[key.trim()] = value.trim();
      }
    });

    try {
      await createEnvironment(formName.trim(), variables);
      resetForm();
    } catch (error) {
      console.error("Failed to create environment:", error);
    }
  };

  const handleUpdateEnvironment = async () => {
    if (!editingEnv || !formName.trim()) return;

    const variables: Record<string, string> = {};
    formVariables.forEach(({ key, value }) => {
      if (key.trim() && value.trim()) {
        variables[key.trim()] = value.trim();
      }
    });

    try {
      await updateEnvironment(editingEnv.id, formName.trim(), variables);
      resetForm();
      setSelectedEnv(null);
    } catch (error) {
      console.error("Failed to update environment:", error);
    }
  };

  const handleDeleteEnvironment = async (env: Environment) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${env.name}"? This action cannot be undone.`,
      )
    ) {
      try {
        await deleteEnvironment(env.id);
        if (selectedEnv?.id === env.id) {
          setSelectedEnv(null);
        }
      } catch (error) {
        console.error("Failed to delete environment:", error);
      }
    }
  };

  const startEditing = (env: Environment) => {
    setEditingEnv(env);
    setFormName(env.name);
    const variables = Object.entries(env.variables).map(([key, value]) => ({
      key,
      value,
    }));
    setFormVariables(
      variables.length > 0 ? variables : [{ key: "", value: "" }],
    );
    setShowNewForm(false);
  };

  const addVariable = () => {
    setFormVariables([...formVariables, { key: "", value: "" }]);
  };

  const updateVariable = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    const updated = [...formVariables];
    updated[index][field] = value;
    setFormVariables(updated);
  };

  const removeVariable = (index: number) => {
    if (formVariables.length > 1) {
      setFormVariables(formVariables.filter((_, i) => i !== index));
    }
  };

  const toggleVariableVisibility = (envId: string) => {
    setShowVariables((prev) => ({
      ...prev,
      [envId]: !prev[envId],
    }));
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedVar(key);
      setTimeout(() => setCopiedVar(null), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleSetActive = async (env: Environment) => {
    try {
      const newActiveId = activeEnvironment?.id === env.id ? null : env.id;
      await setActiveEnvironment(newActiveId);
    } catch (error) {
      console.error("Failed to set active environment:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl mx-4 h-[80vh] flex overflow-hidden">
        {/* Left Panel - Environment List */}
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                <Globe className="h-5 w-5 mr-2" />
                Environment Manager
              </h2>
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={() => {
                setShowNewForm(true);
                setEditingEnv(null);
                setSelectedEnv(null);
                resetForm();
              }}
              className="w-full btn-primary flex items-center justify-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Environment
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {environments.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No environments yet. Create one to get started.
              </div>
            ) : (
              <div className="p-2">
                {environments.map((env) => (
                  <div
                    key={env.id}
                    className={`p-3 rounded-lg mb-2 border cursor-pointer transition-colors ${
                      selectedEnv?.id === env.id
                        ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    } ${
                      activeEnvironment?.id === env.id
                        ? "ring-2 ring-green-200 dark:ring-green-500"
                        : ""
                    }`}
                    onClick={() => setSelectedEnv(env)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {env.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {Object.keys(env.variables).length} variable(s)
                        </div>
                        {activeEnvironment?.id === env.id && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            ACTIVE
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(env);
                          }}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                          title="Edit environment"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEnvironment(env);
                          }}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded"
                          title="Delete environment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Details/Form */}
        <div className="flex-1 flex flex-col">
          {showNewForm || editingEnv ? (
            /* Form Panel */
            <div className="flex-1 p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {editingEnv ? "Edit Environment" : "Create New Environment"}
                </h3>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full form-input"
                    placeholder="Development, Staging, Production..."
                    autoFocus
                  />
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Variables
                    </label>
                    <button
                      onClick={addVariable}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Variable
                    </button>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {formVariables.map((variable, index) => (
                      <div key={index} className="flex space-x-2">
                        <input
                          type="text"
                          value={variable.key}
                          onChange={(e) =>
                            updateVariable(index, "key", e.target.value)
                          }
                          className="flex-1 form-input text-sm"
                          placeholder="Variable name (e.g., API_URL)"
                        />
                        <input
                          type="text"
                          value={variable.value}
                          onChange={(e) =>
                            updateVariable(index, "value", e.target.value)
                          }
                          className="flex-1 form-input text-sm"
                          placeholder="Variable value (e.g., https://api.example.com)"
                        />
                        {formVariables.length > 1 && (
                          <button
                            onClick={() => removeVariable(index)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={
                    editingEnv
                      ? handleUpdateEnvironment
                      : handleCreateEnvironment
                  }
                  disabled={!formName.trim()}
                  className="btn-primary flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingEnv ? "Update" : "Create"}
                </button>
                <button onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          ) : selectedEnv ? (
            /* Details Panel */
            <div className="flex-1 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedEnv.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Created{" "}
                    {new Date(selectedEnv.created_at).toLocaleDateString()}
                    {selectedEnv.updated_at !== selectedEnv.created_at && (
                      <span>
                        {" "}
                        • Updated{" "}
                        {new Date(selectedEnv.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSetActive(selectedEnv)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      activeEnvironment?.id === selectedEnv.id
                        ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                        : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                    }`}
                  >
                    {activeEnvironment?.id === selectedEnv.id
                      ? "Deactivate"
                      : "Set Active"}
                  </button>
                  <button
                    onClick={() => startEditing(selectedEnv)}
                    className="btn-secondary flex items-center"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Variables ({Object.keys(selectedEnv.variables).length})
                  </h4>
                  <button
                    onClick={() => toggleVariableVisibility(selectedEnv.id)}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center"
                  >
                    {showVariables[selectedEnv.id] ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-1" />
                        Hide Values
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-1" />
                        Show Values
                      </>
                    )}
                  </button>
                </div>

                {Object.keys(selectedEnv.variables).length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No variables defined in this environment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(selectedEnv.variables).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                              {key}
                            </div>
                            <button
                              onClick={() => copyToClipboard(value, key)}
                              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                              title="Copy value"
                            >
                              {copiedVar === key ? (
                                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <div className="font-mono text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 p-2">
                            {showVariables[selectedEnv.id]
                              ? value
                              : "••••••••••••"}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Welcome Panel */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Environment Management
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                  Manage your API environments and variables. Select an
                  environment from the left to view its details, or create a new
                  one to get started.
                </p>
                <button
                  onClick={() => {
                    setShowNewForm(true);
                    resetForm();
                  }}
                  className="btn-primary flex items-center mx-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Environment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnvironmentManager;
