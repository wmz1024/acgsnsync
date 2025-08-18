import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { open } from '@tauri-apps/api/dialog';
import { appWindow } from '@tauri-apps/api/window';
import { FolderUp, History, Folder as FolderIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface TargetDirectorySelectorProps {
  onDirectorySelect: (path: string) => void;
  disabled?: boolean;
}

const HISTORY_KEY = 'sync_directory_history';
const MAX_HISTORY = 3;

export function TargetDirectorySelector({ onDirectorySelect, disabled }: TargetDirectorySelectorProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load directory history:", e);
    }

    const unlisten = appWindow.onFileDropEvent((event) => {
      if (event.payload.type === 'drop') {
        const droppedPath = event.payload.paths[0];
        // Basic check if it's likely a directory
        if (droppedPath) {
             handleDirectorySelected(droppedPath);
        }
      }
      setIsDragOver(false);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const updateHistory = (newPath: string) => {
    const newHistory = [newPath, ...history.filter(p => p !== newPath)].slice(0, MAX_HISTORY);
    setHistory(newHistory);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save directory history:", e);
    }
  };
  
  const handleDirectorySelected = (path: string) => {
    // A simple check to remove trailing slashes for consistency
    const normalizedPath = path.replace(/[/\\]+$/, '');
    onDirectorySelect(normalizedPath);
    updateHistory(normalizedPath);
  };

  const handleSelectDirClick = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择同步目录',
    });
    if (typeof selected === 'string') {
        handleDirectorySelected(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>选择同步目录</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => { // This is mainly to finalize the visual state
              e.preventDefault();
              setIsDragOver(false);
          }}
          className={`p-6 border-2 border-dashed rounded-md text-center transition-colors ${
            isDragOver ? 'bg-muted border-primary' : 'bg-transparent'
          }`}
        >
          <FolderUp className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">
            将文件夹拖放到此处，或点击下方按钮
          </p>
          <Button onClick={handleSelectDirClick} disabled={disabled}>
            <FolderIcon className="mr-2 h-4 w-4" /> 从文件管理器选择
          </Button>
        </div>
        
        {history.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium flex items-center mb-2">
                <History className="w-4 h-4 mr-2" /> 最近使用的目录
            </h4>
            <div className="space-y-2">
              {history.map(path => (
                <Button 
                  key={path}
                  variant="outline" 
                  className="w-full justify-start text-left h-auto"
                  onClick={() => handleDirectorySelected(path)}
                  disabled={disabled}
                >
                  <FolderIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{path}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 