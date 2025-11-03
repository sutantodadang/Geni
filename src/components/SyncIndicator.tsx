import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Cloud, CloudOff, Loader2 } from "lucide-react";

interface SyncStatus {
  is_authenticated: boolean;
  unsynced_collections_count: number;
  unsynced_requests_count: number;
  unsynced_environments_count: number;
  last_sync: string | null;
}

interface SyncIndicatorProps {
  onClick: () => void;
}

export default function SyncIndicator({ onClick }: SyncIndicatorProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSyncStatus();
    // Poll sync status every 30 seconds
    const interval = setInterval(loadSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await invoke<SyncStatus>("get_sync_status");
      setSyncStatus(status);
    } catch (error) {
      console.error("Error loading sync status:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalUnsynced = syncStatus
    ? syncStatus.unsynced_collections_count +
      syncStatus.unsynced_requests_count +
      syncStatus.unsynced_environments_count
    : 0;

  if (loading) {
    return (
      <button
        onClick={onClick}
        className="p-2 text-gray-500 dark:text-gray-400 rounded-lg"
        title="Loading sync status..."
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors relative ${
        syncStatus?.is_authenticated
          ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
      title={
        syncStatus?.is_authenticated
          ? `Cloud sync enabled${
              totalUnsynced > 0 ? ` - ${totalUnsynced} unsynced items` : ""
            }`
          : "Cloud sync disabled - Click to configure"
      }
    >
      {syncStatus?.is_authenticated ? (
        <Cloud className="h-4 w-4" />
      ) : (
        <CloudOff className="h-4 w-4" />
      )}
      {totalUnsynced > 0 && (
        <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
          {totalUnsynced > 9 ? "9+" : totalUnsynced}
        </span>
      )}
    </button>
  );
}
