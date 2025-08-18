import "./App.css";
import { useState, useEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Sidebar, SidebarHeader, SidebarContent, SidebarNav } from "@/components/ui/sidebar";
import { ExportTab } from "@/components/export-tab";
import { SyncMarket } from "@/components/sync-market";
import { SyncConfirmation } from "@/components/sync-confirmation";
import { SettingsDialog } from "@/components/settings-dialog";
import { UpdateDialog } from "@/components/update-dialog";
import { HomePage } from "@/components/home-page";
import { Settings, Download, ShoppingCart, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api";
import { Logo } from "@/components/logo";

const THREAD_COUNT_KEY = 'sync_thread_count';
const CURRENT_VERSION = '1.0.4'; // This should be updated by the developer for each release

interface UpdateInfo {
    version: string;
    url: string;
}

export const App = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [view, setView] = useState<'market' | 'confirmation'>('market');
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    const applyThreadSetting = async () => {
        try {
            const storedCount = localStorage.getItem(THREAD_COUNT_KEY);
            if (storedCount) {
                await invoke('set_thread_pool', { numThreads: parseInt(storedCount, 10) });
            }
        } catch (e) {
            console.error("Failed to apply thread settings on startup:", e);
        }
    };
    
    const checkForUpdates = async () => {
        try {
            const data = await invoke<UpdateInfo>('check_for_updates');
            if (data.version !== CURRENT_VERSION) {
                setUpdateInfo(data);
            }
        } catch (e) {
            console.error("Failed to check for updates:", e);
        }
    };

    applyThreadSetting();
    checkForUpdates();
  }, []);

  const handleSync = (url: string) => {
    setManifestUrl(url);
    setView('confirmation');
  };

  const handleBack = () => {
    setView('market');
    setManifestUrl(null);
  };
  
  const sidebarItems = [
    {
      title: "首页",
      icon: <Home className="h-4 w-4" />,
      isActive: activeTab === "home",
      onClick: () => setActiveTab("home"),
    },
    {
      title: "导出",
      icon: <Download className="h-4 w-4" />,
      isActive: activeTab === "export",
      onClick: () => setActiveTab("export"),
    },
    {
      title: "同步市场",
      icon: <ShoppingCart className="h-4 w-4" />,
      isActive: activeTab === "sync_market",
      onClick: () => {
        setActiveTab("sync_market");
        setView('market'); // Reset to market view when tab is clicked
      },
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <HomePage />;
      case "export":
        return <ExportTab />;
      case "sync_market":
        if (view === 'confirmation' && manifestUrl) {
            return <SyncConfirmation manifestUrl={manifestUrl} onBack={handleBack} />;
        }
        return <SyncMarket onSync={handleSync} />;
      default:
        return <HomePage />;
    }
  };


  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="flex h-screen w-screen bg-background">
            <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center space-x-2">
                        <Logo />
                        <span className="font-semibold">ACGStation Sync</span>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarNav items={sidebarItems} />
                </SidebarContent>
                <div className="p-2 flex justify-end gap-2 border-t">
                    <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                        <Settings className="h-5 w-5" />
                    </Button>
                    <ModeToggle />
                </div>
            </Sidebar>
            <main className="flex-1 overflow-auto">
                {renderContent()}
            </main>
        </div>
       <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
       {updateInfo && (
        <UpdateDialog 
            isOpen={true} 
            onClose={() => setUpdateInfo(null)}
            version={updateInfo.version}
            url={updateInfo.url}
        />
       )}
    </ThemeProvider>
  );
};

export default App;
