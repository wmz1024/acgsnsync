import { useState } from 'react';
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

interface CustomSyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (url: string) => void;
}

export function CustomSyncDialog({ isOpen, onClose, onSync }: CustomSyncDialogProps) {
  const [url, setUrl] = useState('');

  const handleSyncClick = () => {
    if (url) {
      onSync(url);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>同步自定义包</DialogTitle>
          <DialogDescription>
            请输入清单文件的URL（manifest.json）以开始同步。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <Label htmlFor="manifest-url" className="text-left">
              清单URL
            </Label>
            <Input
              id="manifest-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/manifest.json"
            />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSyncClick} disabled={!url}>同步</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 