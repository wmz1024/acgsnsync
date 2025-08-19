import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { open } from '@tauri-apps/api/dialog';
import { appWindow } from '@tauri-apps/api/window';
import { FolderUp } from 'lucide-react';

interface CustomSyncImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (url: string, localPackagePath?: string, useLocalFiles?: boolean) => void;
}

export function CustomSyncImporter({ isOpen, onClose, onSync }: CustomSyncImporterProps) {
  const [url, setUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [source, setSource] = useState<'network' | 'local'>('network');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState('url');

  useEffect(() => {
    const unlisten = appWindow.onFileDropEvent((event) => {
      if (event.payload.type === 'drop') {
        handleFileDrop(event.payload.paths);
      }
      setIsDragOver(false);
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  const handleFileDrop = async (paths: string[]) => {
    const path = paths[0];
    if (path.endsWith('.zip') || path.endsWith('.json')) {
      setLocalPath(path);
      setActiveTab(path.endsWith('.zip') ? 'zip' : 'file');
    }
  };

  const handleSelectFile = async (extensions: string[]) => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Sync File', extensions }]
    });
    if (typeof selected === 'string') {
      setLocalPath(selected);
    }
  };
  
  const handleSyncClick = () => {
    if (activeTab === 'url' && url) {
      onSync(url);
      onClose();
    } else if (activeTab === 'zip' && localPath) {
        onSync('', localPath, source === 'local');
        onClose();
    } else if (activeTab === 'file' && localPath) {
        onSync(localPath, undefined, false); // Local manifest means network download
        onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>同步自定义包</DialogTitle>
          <DialogDescription>
            从URL、本地压缩包或manifest.json文件进行同步。
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
                <TabsTrigger value="url">从URL同步</TabsTrigger>
                <TabsTrigger value="zip">从本地压缩包同步</TabsTrigger>
                <TabsTrigger value="file">从本地清单同步</TabsTrigger>
            </TabsList>

            <TabsContent value="url">
                <div className="grid gap-4 py-4">
                    <Label htmlFor="manifest-url">清单URL</Label>
                    <Input id="manifest-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/manifest.json"/>
                </div>
            </TabsContent>

            <TabsContent value="zip">
                <div className="py-4 space-y-4">
                    <div onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={(e) => { e.preventDefault(); setIsDragOver(false); }} className={`p-6 border-2 border-dashed rounded-md text-center ${isDragOver ? 'border-primary' : ''}`}>
                        <FolderUp className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">{localPath || '将.zip文件拖放到此处'}</p>
                    </div>
                    <Button variant="outline" onClick={() => handleSelectFile(['zip'])}>或选择文件</Button>
                    <RadioGroup value={source} onValueChange={(v) => setSource(v as any)}>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="network" id="r1" /><Label htmlFor="r1">从网络下载文件</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="local" id="r2" /><Label htmlFor="r2">从压缩包中提取文件</Label></div>
                    </RadioGroup>
                </div>
            </TabsContent>
            
            <TabsContent value="file">
                 <div className="py-4 space-y-4">
                    <div onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={(e) => { e.preventDefault(); setIsDragOver(false); }} className={`p-6 border-2 border-dashed rounded-md text-center ${isDragOver ? 'border-primary' : ''}`}>
                        <FolderUp className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">{localPath || '将.json文件拖放到此处'}</p>
                    </div>
                    <Button variant="outline" onClick={() => handleSelectFile(['json'])}>或选择文件</Button>
                </div>
            </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSyncClick}>同步</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 