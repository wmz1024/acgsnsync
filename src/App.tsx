import "./App.css";
import { useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Sidebar, SidebarHeader, SidebarContent, SidebarNav } from "@/components/ui/sidebar";
import { FileText, Download, Settings, ShoppingCart } from "lucide-react";
import { ExportTab } from "@/components/export-tab";
import { SyncMarket } from "@/components/sync-market";

export const App = () => {
  const [activeTab, setActiveTab] = useState("export");

  const sidebarItems = [
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
      onClick: () => setActiveTab("sync_market"),
    },
    {
      title: "设置",
      icon: <Settings className="h-4 w-4" />,
      isActive: activeTab === "settings",
      onClick: () => setActiveTab("settings"),
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "export":
        return <ExportTab />;
      case "sync_market":
        return <SyncMarket />;
      case "settings":
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">设置</h2>
            <p className="text-muted-foreground">设置功能将在后续版本中添加</p>
          </div>
        );
      default:
        return <ExportTab />;
    }
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <FileText className="h-6 w-6" />
                <span className="font-semibold">ACGStation</span>
              </div>
              <ModeToggle />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarNav items={sidebarItems} />
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 overflow-hidden">
          {renderContent()}
        </main>
      </div>
    </ThemeProvider>
  );
};
