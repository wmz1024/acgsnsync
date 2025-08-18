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
import { Label } from './ui/label';
import { invoke } from '@tauri-apps/api';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const THREAD_COUNT_KEY = 'sync_thread_count';

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [threadCount, setThreadCount] = useState(0); // 0 means use Rayon's default

  useEffect(() => {
    try {
      const storedCount = localStorage.getItem(THREAD_COUNT_KEY);
      if (storedCount) {
        setThreadCount(parseInt(storedCount, 10));
      } else {
        // Get CPU count for a sensible default placeholder
        invoke<number>('get_cpu_count').then(_cpuCount => {
             // Default to 0, but placeholder can suggest a number
        });
      }
    } catch (e) {
      console.error('Failed to load thread count:', e);
    }
  }, []);

  const handleSave = async () => {
    try {
      localStorage.setItem(THREAD_COUNT_KEY, threadCount.toString());
      await invoke('set_thread_pool', { numThreads: threadCount });
      onClose();
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            调整应用程序以优化性能。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="thread-count" className="text-right">
              同步线程数
            </Label>
            <input
              id="thread-count"
              type="number"
              value={threadCount}
              onChange={(e) => setThreadCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="col-span-3 p-2 border rounded-md"
              min="0"
            />
            <p className="col-span-4 text-xs text-muted-foreground text-center">
              设置为0将使用默认线程数（通常是CPU核心数）。
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 