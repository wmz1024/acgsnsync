import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open, message } from "@tauri-apps/api/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Download, Trash2 } from "lucide-react";
import { EnhancedFileItem } from "@/components/enhanced-file-item";

interface FileItem {
  path: string;
  name: string;
  isDirectory: boolean;
  size?: number;
  selected: boolean;
  compress?: boolean; // 是否压缩该文件夹
  isUpdatePackage?: boolean; // 是否为压缩包更新（减少服务器请求）
}

export function ExportTab() {
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportSettings, setExportSettings] = useState({
    packageName: "",
    downloadPrefix: "https://example.com/downloads/",
    version: "1.0.0"
  });

  const selectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择要导出的文件夹"
      });
      
      if (selected && typeof selected === "string") {
        setSelectedFolder(selected);
        await loadFolderContents(selected);
      }
    } catch (error) {
      console.error("选择文件夹失败:", error);
    }
  };

  const loadFolderContents = async (folderPath: string) => {
    setIsLoading(true);
    try {
      const contents: FileItem[] = await invoke("get_folder_contents", { path: folderPath });
      console.log("Loaded folder contents:", contents); // 调试信息
      setFiles(contents.map(item => ({ 
        ...item, 
        selected: false, 
        compress: false, 
        isUpdatePackage: false 
      })));
    } catch (error) {
      console.error("加载文件夹内容失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (path: string, checked: boolean) => {
    setFiles(files.map(file => 
      file.path === path ? { ...file, selected: checked } : file
    ));
  };

  const toggleCompression = (path: string, checked: boolean) => {
    setFiles(files.map(file => 
      file.path === path ? { ...file, compress: checked, isUpdatePackage: checked ? file.isUpdatePackage : false } : file
    ));
  };

  const toggleUpdatePackage = (path: string, checked: boolean) => {
    setFiles(files.map(file => 
      file.path === path ? { ...file, isUpdatePackage: checked } : file
    ));
  };

  const selectAll = () => {
    const allSelected = files.every(file => file.selected);
    setFiles(files.map(file => ({ ...file, selected: !allSelected })));
  };

  const clearSelection = () => {
    setFiles(files.map(file => ({ ...file, selected: false, compress: false, isUpdatePackage: false })));
  };

  const exportFiles = async () => {
    const selectedFiles = files.filter(file => file.selected);
    if (selectedFiles.length === 0) {
      await message("请选择要导出的文件或文件夹", { title: "提示", type: "warning" });
      return;
    }

    setIsLoading(true);
    try {
      // 获取保存路径（当前使用桌面默认路径）
      const savePath = await invoke("save_file_dialog", {
        defaultName: `${exportSettings.packageName || "export"}.zip`
      });

      if (!savePath) {
        await message("获取保存路径失败", { title: "错误", type: "error" });
        setIsLoading(false);
        return;
      }

      // 执行导出
      const result = await invoke("export_files", {
        files: selectedFiles,
        settings: exportSettings,
        savePathStr: savePath
      });
      await message(`导出成功！\n${result}`, { title: "成功", type: "info" });
      console.log("导出结果:", result);
    } catch (error) {
      console.error("导出失败:", error);
      await message(`导出失败: ${error}`, { title: "错误", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = files.filter(file => file.selected).length;

  return (
    <div className="flex h-full">
      {/* 左侧文件浏览器 */}
      <div className="w-1/2 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">文件浏览器</h2>
            <Button onClick={selectFolder} variant="outline" className="flex items-center space-x-2">
              <FolderOpen className="h-4 w-4" />
              <span>选择文件夹</span>
            </Button>
          </div>
          
          {selectedFolder && (
            <div className="text-sm text-muted-foreground">
              当前文件夹: {selectedFolder}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <span>加载中...</span>
            </div>
          ) : files.length > 0 ? (
            <div className="space-y-3">
              {/* 增强文件浏览器 - 显示所有文件 */}
              {files.map((file) => (
                <EnhancedFileItem
                  key={file.path}
                  file={file}
                  onToggleSelection={toggleSelection}
                  onToggleCompression={toggleCompression}
                  onToggleUpdatePackage={toggleUpdatePackage}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              请选择一个文件夹开始
            </div>
          )}
        </div>
      </div>

      {/* 右侧导出设置 */}
      <div className="w-1/2 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">导出设置</h2>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* 选择状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">选择状态</CardTitle>
              <CardDescription>
                已选择 {selectedCount} 个项目
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex space-x-2">
                <Button onClick={selectAll} variant="outline" size="sm">
                  全选/取消全选
                </Button>
                <Button onClick={clearSelection} variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  清空选择
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 导出配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">导出配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">包名</label>
                <input
                  type="text"
                  value={exportSettings.packageName}
                  onChange={(e) => setExportSettings(prev => ({
                    ...prev,
                    packageName: e.target.value
                  }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  placeholder="输入包名"
                />
              </div>
              <div>
                <label className="text-sm font-medium">下载链接前缀</label>
                <input
                  type="text"
                  value={exportSettings.downloadPrefix}
                  onChange={(e) => setExportSettings(prev => ({
                    ...prev,
                    downloadPrefix: e.target.value
                  }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  placeholder="https://example.com/downloads/"
                />
              </div>
              <div>
                <label className="text-sm font-medium">版本</label>
                <input
                  type="text"
                  value={exportSettings.version}
                  onChange={(e) => setExportSettings(prev => ({
                    ...prev,
                    version: e.target.value
                  }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  placeholder="1.0.0"
                />
              </div>
            </CardContent>
          </Card>

          {/* 导出按钮 */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={exportFiles} 
                disabled={isLoading || selectedCount === 0}
                className="w-full"
                size="lg"
              >
                <Download className="h-4 w-4 mr-2" />
                {isLoading ? "导出中..." : `导出选中的 ${selectedCount} 个项目`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
