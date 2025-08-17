import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api';
import { listen } from '@tauri-apps/api/event';
import { ArrowLeft, AlertCircle, CheckCircle, XCircle, ArrowDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { Progress } from './ui/progress';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';

interface SyncConfirmationProps {
  manifestUrl: string;
  onBack: () => void;
}

interface Manifest {
  packageName?: string;
  package_name?: string;
  version: string;
  files: ManifestFile[];
}

interface ManifestFile {
  name: string;
  relativePath?: string;
  relative_path?: string;
  hash: string;
  size: number;
  type?: 'file' | 'zip' | 'update_package';
  file_type?: 'file' | 'zip' | 'update_package';
  autoExtract?: boolean | null;
  auto_extract?: boolean | null;
  downloadUrl?: string;
  url?: string;
  download_url?: string;
}

interface DownloadProgress {
  file: string;
  downloaded: number;
  total: number;
  progress: number;
}

// Helper to get the download URL regardless of the key used
const getDownloadUrl = (file: ManifestFile): string | undefined => {
  return file.downloadUrl || file.url || file.download_url;
}

// Helper to get the relative path regardless of the key used
const getRelativePath = (file: ManifestFile): string | undefined => {
    return file.relativePath || file.relative_path;
}

enum FileStatus {
    Unchanged = "Unchanged",
    New = "New",
    Modified = "Modified",
    Extra = "Extra",
    Excluded = "Excluded",
    ForceUpdate = "ForceUpdate",
}

interface DiffFile {
    path: string;
    status: FileStatus;
}


const getPackageName = (manifest: Manifest): string | undefined => {
    return manifest.packageName || manifest.package_name;
}


export function SyncConfirmation({ manifestUrl, onBack }: SyncConfirmationProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDir, setTargetDir] = useState<string | null>(null);
  const [excludedFiles, setExcludedFiles] = useState<string[]>([]);
  const [fileDiff, setFileDiff] = useState<DiffFile[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [fileProgress, setFileProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const response = await fetch(manifestUrl);
        if (!response.ok) {
          throw new Error(`清单文件获取失败: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        try {
          const data: Manifest = JSON.parse(text);
          if (!getPackageName(data)) {
            throw new Error("清单文件格式错误: 缺少 'packageName' 或 'package_name' 字段。");
          }
          if (!data.files || !Array.isArray(data.files)) {
            throw new Error("清单文件格式错误: 'files' 字段不存在或不是一个数组。");
          }
          // Validate that each file has required fields
          for (const file of data.files) {
            if (!getDownloadUrl(file)) {
              throw new Error(`文件 "${file.name}" 缺少下载链接 ('downloadUrl', 'url', or 'download_url')。`);
            }
            if (!getRelativePath(file)) {
              throw new Error(`文件 "${file.name}" 缺少相对路径 ('relativePath' or 'relative_path')。`);
            }
          }
          setManifest(data);
        } catch (jsonError: any) {
          throw new Error(`清单文件JSON解析失败: ${jsonError.message}`);
        }

      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchManifest();

    let unlistenOverall: () => void;
    let unlistenFile: () => void;

    const setupListeners = async () => {
      unlistenOverall = await listen<number>('OVERALL_PROGRESS', (event) => {
        setOverallProgress(event.payload);
      });
      unlistenFile = await listen<DownloadProgress>('DOWNLOAD_PROGRESS', (event) => {
        setFileProgress(event.payload);
      });
    };

    setupListeners();

    return () => {
      if (unlistenOverall) unlistenOverall();
      if (unlistenFile) unlistenFile();
    };
  }, [manifestUrl]);

  useEffect(() => {
    const calculateDiff = async () => {
        if (!targetDir || !manifest) {
            setFileDiff([]);
            return;
        }

        try {
            const diffResult: DiffFile[] = await invoke('calculate_diff', {
                manifest,
                targetDir,
                excludedFiles,
            });
            setFileDiff(diffResult);
        } catch (e: any) {
            setError(`Failed to calculate diff: ${e.toString()}`);
        }
    };
    calculateDiff();
  }, [targetDir, manifest, excludedFiles]);


  const handleSelectDir = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择同步目录',
    });
    if (typeof selected === 'string') {
      setTargetDir(selected);
      try {
        const list: string[] = await invoke('load_exclusion_list', { targetDir: selected });
        setExcludedFiles(list);
      } catch (e) {
        console.error("Failed to load exclusion list:", e);
        // Handle error, maybe show a toast
      }
    }
  };

  const handleToggleFileSelection = (relativePath: string) => {
    setExcludedFiles(prev => 
      prev.includes(relativePath)
        ? prev.filter(p => p !== relativePath)
        : [...prev, relativePath]
    );
  };

  const handleStartSync = async () => {
    if (!targetDir || !manifest) return;
    setIsDownloading(true);
    setOverallProgress(0);
    setFileProgress(null);

    try {
      // Save the exclusion list before starting the download
      await invoke('save_exclusion_list', { targetDir, excludedFiles });

      // Pass the manifest data directly to the backend
      await invoke('start_download', {
        manifest,
        targetDir,
        excludedFiles,
      });
    } catch (e: any) {
      setError(`下载启动失败: ${e.toString()}`);
      setIsDownloading(false);
    }
  };
  
  if (error) {
    return (
      <div className="p-6 text-red-500 flex flex-col items-center justify-center h-full">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h3 className="text-lg font-bold mb-2">加载清单时出错</h3>
        <p className="text-sm text-center mb-4">无法获取或解析同步清单。请检查URL是否正确，以及文件格式是否符合规范。</p>
        <pre className="text-xs bg-red-100 p-4 rounded-md w-full text-left overflow-auto">
          {error}
        </pre>
        <Button onClick={onBack} className="mt-4">返回同步市场</Button>
      </div>
    );
  }

  if (isLoading) return <div className="p-6">正在加载清单...</div>;
  if (!manifest) return <div className="p-6">未找到清单。</div>;

  return (
    <div className="p-6 h-full flex flex-col">
       <div className="flex items-center mb-4">
         <Button onClick={onBack} variant="ghost" size="icon">
           <ArrowLeft className="h-4 w-4" />
         </Button>
         <h2 className="text-2xl font-bold ml-2">同步确认: {getPackageName(manifest)}</h2>
       </div>
       
       <Card>
         <CardHeader>
           <CardTitle>选择同步目录</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="flex items-center space-x-4">
             <Button onClick={handleSelectDir}>选择目录</Button>
             <div className="text-sm p-2 bg-muted rounded-md flex-grow">
               {targetDir ? `将同步到: ${targetDir}` : '请选择一个目录'}
             </div>
           </div>
         </CardContent>
       </Card>
 
       <div className="flex-grow mt-4 overflow-auto">
         <h3 className="text-lg font-semibold mb-2">同步计划</h3>
         <ScrollArea className="h-64 border rounded-md">
            <div className="p-4 space-y-2">
                {fileDiff.map((file, index) => {
                    const isExcluded = file.status === FileStatus.Excluded;
                    let Icon = AlertTriangle;
                    let textClass = "";
                    let description = "";

                    switch (file.status) {
                        case FileStatus.New:
                            Icon = ArrowDown; textClass = "text-green-600"; description = "新增";
                            break;
                        case FileStatus.Modified:
                            Icon = RefreshCw; textClass = "text-blue-600"; description = "更新";
                            break;
                        case FileStatus.ForceUpdate:
                            Icon = RefreshCw; textClass = "text-orange-600"; description = "强制更新 (压缩包)";
                            break;
                        case FileStatus.Extra:
                            Icon = XCircle; textClass = "text-red-600"; description = "删除";
                            break;
                        case FileStatus.Unchanged:
                            Icon = CheckCircle; textClass = "text-gray-500"; description = "不变";
                            break;
                        case FileStatus.Excluded:
                            Icon = XCircle; textClass = "text-gray-500 line-through"; description = "排除";
                            break;
                    }
                    
                    return (
                        <div key={`${file.path}-${index}`} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted">
                            <Checkbox
                                id={file.path}
                                checked={!isExcluded}
                                onCheckedChange={() => handleToggleFileSelection(file.path)}
                            />
                            <Icon className={`w-4 h-4 ${textClass}`} />
                            <label htmlFor={file.path} className={`text-sm cursor-pointer flex-grow ${textClass}`}>
                                {file.path}
                            </label>
                            <span className={`text-xs px-2 py-1 rounded-full ${textClass}`}>{description}</span>
                        </div>
                    );
                })}
            </div>
         </ScrollArea>
       </div>
 
       <div className="mt-4">
         {isDownloading ? (
           <div className="space-y-2">
             <Progress value={overallProgress} />
             <div className="text-sm text-center">总进度: {overallProgress.toFixed(2)}%</div>
             {fileProgress && (
               <div className="text-xs text-center text-muted-foreground">
                 正在下载: {fileProgress.file} ({fileProgress.progress.toFixed(2)}%)
               </div>
             )}
           </div>
         ) : (
           <Button className="w-full" disabled={!targetDir} onClick={handleStartSync}>开始同步</Button>
         )}
       </div>
     </div>
  );
}
