import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open, message, save } from "@tauri-apps/api/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Download, Trash2 } from "lucide-react";
import { EnhancedFileItem } from "@/components/enhanced-file-item";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { listen } from "@tauri-apps/api/event";

interface FileItem {
  path: string;
  name: string;
  isDirectory: boolean;
  size?: number;
  selected: boolean;
  compress?: boolean; // 是否压缩该文件夹
  isUpdatePackage?: boolean; // 是否为压缩包更新（减少服务器请求）
  exclusions?: string[];
}

interface ExportProgress {
    total: number;
    current: number;
    fileName: string;
}

export function ExportTab() {
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportSettings, setExportSettings] = useState({
    packageName: "ACGStation-",
    downloadPrefix: "https://file.iscar.net/d/mzclink-cn/acgsn/",
    version: "1.0.0",
    description: "# ACGStation - 包名（允许使用markdown）",
    disableHashCheck: false,
    disableSizeCheck: false,
  });

  useEffect(() => {
    let unlisten: () => void;
    
    const setupListener = async () => {
        unlisten = await listen<ExportProgress>('EXPORT_PROGRESS', (event) => {
            setExportProgress(event.payload);
        });
    };

    setupListener();

    return () => {
        if (unlisten) unlisten();
    };
  }, []);

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

  const updateExclusions = (path: string, exclusions: string[]) => {
    setFiles(files.map(file => 
      file.path === path ? { ...file, exclusions } : file
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

    const savePath = await save({
      defaultPath: `${exportSettings.packageName || "export"}.zip`,
      filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
    });

    if (!savePath) return;

    setIsLoading(true);
    setExportProgress({ total: selectedFiles.length, current: 0, fileName: 'Starting...' });
    try {
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
      setExportProgress(null);
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
                  onUpdateExclusions={updateExclusions}
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
              <div>
                <label className="text-sm font-medium">简介</label>
                <Textarea
                  value={exportSettings.description}
                  onChange={(e) => setExportSettings(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  className="w-full mt-1"
                  placeholder="输入简介内容..."
                  rows={4}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="disable-hash-check"
                  checked={exportSettings.disableHashCheck}
                  onCheckedChange={(checked) => setExportSettings(prev => ({ ...prev, disableHashCheck: !!checked }))}
                />
                <label htmlFor="disable-hash-check" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  禁用哈希校验
                </label>
              </div>
              <div className="flex items-center space-x-2">
                 <Checkbox
                  id="disable-size-check"
                  checked={exportSettings.disableSizeCheck}
                  onCheckedChange={(checked) => setExportSettings(prev => ({ ...prev, disableSizeCheck: !!checked }))}
                />
                <label htmlFor="disable-size-check" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  禁用大小校验
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 导出按钮 */}
          <Card>
            <CardContent className="pt-6">
                {isLoading && exportProgress ? (
                    <div className="space-y-2">
                        <Progress value={(exportProgress.current / exportProgress.total) * 100} />
                        <div className="text-xs text-center text-muted-foreground">
                            ({exportProgress.current}/{exportProgress.total}) 正在处理: {exportProgress.fileName}
                        </div>
                    </div>
                ) : (
                    <Button 
                        onClick={exportFiles} 
                        disabled={isLoading || selectedCount === 0}
                        className="w-full"
                        size="lg"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        {`导出选中的 ${selectedCount} 个项目`}
                    </Button>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
