import React, { useState, useEffect } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, RefreshCw } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

interface UpdateManagerProps {
  onUpdateAvailable?: (available: boolean) => void;
}

/**
 * UpdateManager handles checking for app updates using the tauri-plugin-updater.
 * It provides a "one-click" experience to download, install, and relaunch the app.
 */
const UpdateManager: React.FC<UpdateManagerProps> = ({ onUpdateAvailable }) => {
  const [update, setUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { success, error, info } = useToast();

  const checkForUpdates = async (silent = true) => {
    if (checking) return;
    setChecking(true);
    try {
      const update = await check();
      if (update) {
        setUpdate(update);
        if (onUpdateAvailable) onUpdateAvailable(true);
        if (!silent) {
          info(`New version available: ${update.version}`);
        }
      } else {
        if (!silent) {
          success("You are on the latest version.");
        }
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      if (!silent) {
        error("Failed to check for updates.");
      }
    } finally {
      setChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!update || downloading) return;

    setDownloading(true);
    try {
      info("Downloading update...");
      
      // Download and install the update
      // For Tauri 2, downloadAndInstall takes a callback for progress
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            console.log('Download started');
            break;
          case 'Progress':
            console.log(`Downloaded ${event.data.chunkLength} bytes`);
            break;
          case 'Finished':
            console.log('Download finished');
            break;
        }
      });

      success("Update installed! Restarting Geni...");
      await relaunch();
    } catch (err) {
      console.error("Failed to install update:", err);
      error("Failed to install update. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    checkForUpdates();
    // Check every hour
    const interval = setInterval(() => checkForUpdates(), 3600000);
    return () => clearInterval(interval);
  }, []);

  if (!update) return null;

  return (
    <button
      onClick={installUpdate}
      disabled={downloading}
      className={`
        flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-200
        ${downloading 
          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed" 
          : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md animate-pulse"
        }
      `}
      title={`Update to version ${update.version}`}
    >
      {downloading ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <Download className="h-3 w-3" />
      )}
      <span>{downloading ? "Installing..." : `Update to v${update.version}`}</span>
    </button>
  );
};

export default UpdateManager;
