import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { invoke } from '@tauri-apps/api';
import { listen } from '@tauri-apps/api/event';
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';
import { ExclusionEditor } from './exclusion-editor';
import { FileTree, buildFileTree, FileStatus, DiffFile } from './file-tree';
import { TargetDirectorySelector } from './target-directory-selector';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


interface SyncConfirmationProps {
  manifestUrl: string;
  onBack: () => void;
}

interface Manifest {
  packageName?: string;
  package_name?: string;
  version: string;
  description?: string;
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

export { FileStatus };
export type { DiffFile };

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
  const [isCalculatingDiff, setIsCalculatingDiff] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [fileProgress, setFileProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExclusionEditorOpen, setIsExclusionEditorOpen] = useState(false);

  const fileTree = useMemo(() => buildFileTree(fileDiff), [fileDiff]);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const text = await invoke<string>('fetch_manifest_text', { url: manifestUrl });

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

        setIsCalculatingDiff(true);
        try {
            const diffResult: DiffFile[] = await invoke('calculate_diff', {
                manifest,
                targetDir,
                excludedFiles,
            });
            setFileDiff(diffResult);
        } catch (e: any) {
            setError(`Failed to calculate diff: ${e.toString()}`);
        } finally {
            setIsCalculatingDiff(false);
        }
    };
    calculateDiff();
  }, [targetDir, manifest, excludedFiles]);


  const handleDirectorySelected = async (path: string) => {
    setTargetDir(path);
    try {
      const list: string[] = await invoke('load_exclusion_list', { targetDir: path });
      setExcludedFiles(list);
    } catch (e) {
      console.error("Failed to load exclusion list:", e);
      // Handle error, maybe show a toast
    }
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

      {manifest.description && (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle>简介</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="prose dark:prose-invert max-w-none text-sm text-muted-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {manifest.description}
                    </ReactMarkdown>
                </div>
            </CardContent>
        </Card>
      )}
       
      <TargetDirectorySelector onDirectorySelect={handleDirectorySelected} disabled={isCalculatingDiff || isDownloading} />

       <div className="flex-grow mt-4 overflow-auto">
         <h3 className="text-lg font-semibold mb-2">
            {targetDir ? `同步计划: ${targetDir}` : '同步计划'}
         </h3>
         <ScrollArea className="h-64 border rounded-md">
            {isCalculatingDiff ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                正在计算文件差异...
              </div>
            ) : (
                <div className="p-4">
                    <FileTree nodes={fileTree} />
                </div>
            )}
         </ScrollArea>
       </div>
 
       <div className="mt-4">
        <Button
            variant="outline"
            className="w-full mb-2"
            onClick={() => setIsExclusionEditorOpen(true)}
            disabled={!targetDir || isCalculatingDiff}
        >
            管理排除列表
        </Button>
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
           <Button className="w-full" disabled={!targetDir || isCalculatingDiff} onClick={handleStartSync}>开始同步</Button>
         )}
       </div>
      <ExclusionEditor
        isOpen={isExclusionEditorOpen}
        onClose={() => setIsExclusionEditorOpen(false)}
        targetDir={targetDir || ''}
        initialExcludedFiles={excludedFiles}
        onExclusionChange={setExcludedFiles}
      />
     </div>
  );
}
