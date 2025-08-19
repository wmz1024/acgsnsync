import { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Folder, Archive, Package, Settings } from "lucide-react";
import { Button } from '@/components/ui/button';
import { ExclusionManagerDialog } from './exclusion-manager-dialog';

interface FileItem {
  path: string;
  name: string;
  isDirectory: boolean;
  size?: number;
  selected: boolean;
  compress?: boolean;
  isUpdatePackage?: boolean;
  exclusions?: string[];
}

interface EnhancedFileItemProps {
  file: FileItem;
  onToggleSelection: (path: string, checked: boolean) => void;
  onToggleCompression: (path: string, checked: boolean) => void;
  onToggleUpdatePackage: (path: string, checked: boolean) => void;
  onUpdateExclusions: (path: string, exclusions: string[]) => void;
}

export function EnhancedFileItem({ 
  file, 
  onToggleSelection, 
  onToggleCompression, 
  onToggleUpdatePackage,
  onUpdateExclusions,
}: EnhancedFileItemProps) {
  const [isExclusionManagerOpen, setIsExclusionManagerOpen] = useState(false);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `(${size.toFixed(1)} ${units[unitIndex]})`;
  };

  return (
    <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
      <div className="space-y-3">
        {/* 开发环境显示状态信息 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
            状态: isDirectory={String(file.isDirectory)}, selected={String(file.selected)}, compress={String(file.compress)}, isUpdatePackage={String(file.isUpdatePackage)}
          </div>
        )}
        
        {/* 文件基本信息 */}
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={file.selected}
            onCheckedChange={(checked) => onToggleSelection(file.path, !!checked)}
          />
          
          <div className="flex items-center space-x-2 flex-1">
            {file.isDirectory ? (
              <Folder className="h-5 w-5 text-blue-500" />
            ) : (
              <div className="h-5 w-5 bg-gray-400 rounded flex items-center justify-center text-xs text-white">F</div>
            )}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium">{file.name}</span>
                {!file.isDirectory && file.size && (
                  <span className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {file.path}
              </div>
            </div>
          </div>
        </div>
        
        {/* 文件夹选项 */}
        {file.isDirectory && (
          <div className="ml-8 space-y-3 border-l-2 border-muted pl-4">
            {/* 压缩选项 */}
            <div className="flex items-center space-x-3">
              <Checkbox
                checked={file.compress || false}
                onCheckedChange={(checked) => {
                  console.log(`压缩选项变更: ${file.name} -> ${checked}`);
                  onToggleCompression(file.path, !!checked);
                }}
              />
              <Archive className="h-4 w-4 text-amber-500" />
              <span className="text-sm">压缩此文件夹</span>
            </div>
            
            {/* 更新包选项 */}
            <div className="flex items-center space-x-3">
              <Checkbox
                checked={file.isUpdatePackage || false}
                disabled={!file.compress}
                onCheckedChange={(checked) => {
                  console.log(`更新包选项变更: ${file.name} -> ${checked}`);
                  onToggleUpdatePackage(file.path, !!checked);
                }}
              />
              <Package className={`h-4 w-4 ${file.compress ? 'text-blue-500' : 'text-muted-foreground'}`} />
              <div className="flex flex-col">
                <span className={`text-sm ${file.compress ? 'text-foreground' : 'text-muted-foreground'}`}>
                  作为压缩包更新
                </span>
                <span className="text-xs text-muted-foreground">
                  {file.compress ? '减少服务器请求，自动解压' : '需要先选择压缩选项'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" onClick={() => setIsExclusionManagerOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    管理排除项
                </Button>
                {file.exclusions && file.exclusions.length > 0 && (
                    <span className="text-xs text-muted-foreground">{file.exclusions.length} 个排除项</span>
                )}
            </div>
            
            {/* 选中状态的额外选项显示 */}
            {file.selected && (
              <div className="bg-accent/50 p-2 rounded border">
                <div className="text-xs text-muted-foreground mb-2">已选中 - 导出选项:</div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={file.compress || false}
                      onCheckedChange={(checked) => onToggleCompression(file.path, !!checked)}
                    />
                    <Archive className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">压缩</span>
                  </div>
                  
                  {file.compress && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={file.isUpdatePackage || false}
                        onCheckedChange={(checked) => onToggleUpdatePackage(file.path, !!checked)}
                      />
                      <Package className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">更新包</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <ExclusionManagerDialog
        isOpen={isExclusionManagerOpen}
        onClose={() => setIsExclusionManagerOpen(false)}
        basePath={file.path}
        initialExclusions={file.exclusions || []}
        onSave={(exclusions) => onUpdateExclusions(file.path, exclusions)}
      />
    </div>
  );
}
