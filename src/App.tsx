import "./App.css";
import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { listen } from "@tauri-apps/api/event";
import { appWindow } from "@tauri-apps/api/window";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Sidebar, SidebarHeader, SidebarContent, SidebarNav, SidebarFooter, AuthSection } from "@/components/ui/sidebar";
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
import { authDataAtom, avatarAtom, isSidebarCollapsedAtom } from "@/atoms";

interface SyncOptions {
    manifestUrl: string;
    localPackagePath?: string;
    useLocalFiles?: boolean;
}

const THREAD_COUNT_KEY = 'sync_thread_count';
const CURRENT_VERSION = '1.2.0'; // This should be updated by the developer for each release

interface UpdateInfo {
    version: string;
    url: string;
}

interface AuthData {
  token: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  user: {
    uid: number;
    nickname: string;
  };
}


export const App = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [view, setView] = useState<'market' | 'confirmation'>('market');
  const [syncOptions, setSyncOptions] = useState<SyncOptions | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [, setAuthData] = useAtom(authDataAtom);
  const [, setAvatar] = useAtom(avatarAtom);
  const [isCollapsed, setIsCollapsed] = useAtom(isSidebarCollapsedAtom);


  // 显示 Toast 消息的函数 (简易实现)
  const showToast = (message: string) => {
    alert(message); // 您可以替换为更美观的 Toast 组件
  };

  const handleLogout = () => {
    localStorage.removeItem('authData');
    setAuthData(null);
    setAvatar(null);
  };


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

    const initializeAuth = async () => {
      const storedData = localStorage.getItem('authData');
      if (storedData) {
        try {
          const parsedData: AuthData = JSON.parse(storedData);
          await invoke('validate_token', { accessToken: parsedData.token.access_token });
          setAuthData(parsedData);
        } catch (e) {
          console.error("Token validation failed:", e);
          handleLogout();
          showToast("登录已过期，请重新登录。");
        }
      }
    };

    applyThreadSetting();
    checkForUpdates();
    initializeAuth();

    const unlistenSuccess = listen<AuthData>('oauth_success', (event) => {
      console.log('OAuth Success:', event.payload);
      localStorage.setItem('authData', JSON.stringify(event.payload));
      setAuthData(event.payload);
    });

    const unlistenError = listen<string>('oauth_error', (event) => {
      console.error('OAuth Error:', event.payload);
      showToast(`登录失败: ${event.payload}`);
    });

    // to call set_thread_pool on launch. The default is fine for the first run.
    const setupWindowListeners = async () => {
      const handleResize = async () => {
        const isMaximized = await appWindow.isMaximized();
        setIsCollapsed(!isMaximized);
      };
      // Set initial state on mount
      handleResize();
      const unlisten = await appWindow.onResized(handleResize);
      return unlisten;
    };

    const unlistenResizePromise = setupWindowListeners();

    return () => {
        unlistenSuccess.then(f => f());
        unlistenError.then(f => f());
        unlistenResizePromise.then(unlisten => unlisten());
    }
  }, []);

  const handleSync = (url: string, localPackagePath?: string, useLocalFiles?: boolean) => {
    setSyncOptions({ manifestUrl: url, localPackagePath, useLocalFiles });
    setView('confirmation');
  };

  const handleBack = () => {
    setView('market');
    setSyncOptions(null);
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
        if (view === 'confirmation' && syncOptions) {
            return <SyncConfirmation syncOptions={syncOptions} onBack={handleBack} />;
        }
        return <SyncMarket onSync={handleSync} />;
      default:
        return <HomePage />;
    }
  };


  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="flex h-screen w-screen bg-background">
            <Sidebar isCollapsed={isCollapsed}>
                <SidebarHeader>
                    <div className="flex items-center space-x-2">
                        {isCollapsed ? <img src="/tauri.svg" alt="App Logo" className="w-8 h-8" /> : <Logo />}
                        {!isCollapsed && <span className="font-semibold">ACGStation Sync</span>}
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarNav items={sidebarItems} isCollapsed={isCollapsed} />
                </SidebarContent>
                <SidebarFooter>
                    <AuthSection />
                </SidebarFooter>
                <div className="p-2 flex justify-end gap-2 border-t">
                    {!isCollapsed && (
                        <>
                            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                                <Settings className="h-5 w-5" />
                            </Button>
                            <ModeToggle />
                        </>
                    )}
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
