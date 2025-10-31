import { useEffect, useState } from "react";
import { useAppStore, initializeStore } from "./store";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import RequestPanel from "./components/RequestPanel";
import ResponsePanel from "./components/ResponsePanel";
import CollectionInfo from "./components/CollectionInfo";
import { ToastContainer, useToast } from "./components/Toast";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import EnvironmentManager from "./components/EnvironmentManager";
import { Loader2, Settings, Moon, Sun } from "lucide-react";
import "./App.css";

function AppContent() {
  const {
    tabs,
    activeTabId,
    collectionsLoading,
    environmentsLoading,
    selectedCollectionId,
    collections,
  } = useAppStore();
  const { messages, removeToast } = useToast();
  const { isDark, toggleTheme } = useTheme();
  const [showEnvironmentManager, setShowEnvironmentManager] = useState(false);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const selectedCollection = collections.find(
    (col) => col.id === selectedCollectionId,
  );
  const isLoading = collectionsLoading || environmentsLoading;

  useEffect(() => {
    // Initialize the store on app mount
    initializeStore().catch(console.error);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading Geni...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Geni
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            API Client
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setShowEnvironmentManager(true)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Manage environments"
          >
            <Settings className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            v0.1.0
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Panel */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <TabBar />

          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {activeTab ? (
              <>
                {/* Request Panel */}
                <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
                  <RequestPanel tab={activeTab} />
                </div>

                {/* Response Panel */}
                <div className="w-1/2 flex flex-col">
                  <ResponsePanel tab={activeTab} />
                </div>
              </>
            ) : selectedCollection ? (
              /* Collection Info */
              <CollectionInfo collection={selectedCollection} />
            ) : (
              /* Welcome Screen */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-24 w-24 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="h-12 w-12 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Welcome to Geni
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Create a new request to get started with API testing
                  </p>
                  <button
                    onClick={() => useAppStore.getState().addTab()}
                    className="btn-primary"
                  >
                    New Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer messages={messages} onRemove={removeToast} />

      {/* Environment Manager Modal */}
      {showEnvironmentManager && (
        <EnvironmentManager onClose={() => setShowEnvironmentManager(false)} />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
