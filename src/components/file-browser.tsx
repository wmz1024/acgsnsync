import { Folder, File, Archive, Package } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface FileItem {
  path: string;
  name: string;
  isDirectory: boolean;
  size?: number;
  selected: boolean;
  compress?: boolean;
  isUpdatePackage?: boolean;
}

interface FileBrowserProps {
  files: FileItem[];
  onToggleSelection: (path: string, checked: boolean) => void;
  onToggleCompression: (path: string, checked: boolean) => void;
  onToggleUpdatePackage: (path: string, checked: boolean) => void;
}

export function FileBrowser({ 
  files, 
  onToggleSelection, 
  onToggleCompression, 
  onToggleUpdatePackage 
}: FileBrowserProps) {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.path}
          className={cn(
            "flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent transition-colors",
            file.selected && "bg-accent border-primary"
          )}
        >
          {/* 选择框 */}
          <Checkbox
            checked={file.selected}
            onCheckedChange={(checked) => onToggleSelection(file.path, !!checked)}
          />

          {/* 文件图标 */}
          <div className="flex-shrink-0">
            {file.isDirectory ? (
              <Folder className="h-5 w-5 text-blue-500" />
            ) : (
              <File className="h-5 w-5 text-gray-500" />
            )}
          </div>

          {/* 文件信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="truncate">
                <span className="font-medium">{file.name}</span>
                {!file.isDirectory && file.size && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({formatFileSize(file.size)})
                  </span>
                )}
              </div>
              
              {/* 压缩选项 - 只对文件夹显示 */}
              {file.isDirectory && file.selected && (
                <div className="flex items-center space-x-4 ml-4">
                  {/* 压缩选项 */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={file.compress || false}
                      onCheckedChange={(checked) => {
                        console.log(`Toggling compression for ${file.name}: ${checked}`);
                        onToggleCompression(file.path, !!checked);
                      }}
                    />
                    <Archive className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-muted-foreground">压缩</span>
                  </div>
                  
                  {/* 压缩包更新选项 - 只在选择压缩时显示 */}
                  {file.compress && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={file.isUpdatePackage || false}
                        onCheckedChange={(checked) => {
                          console.log(`Toggling update package for ${file.name}: ${checked}`);
                          onToggleUpdatePackage(file.path, !!checked);
                        }}
                      />
                      <Package className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">更新包</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground truncate">
              {file.path}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}