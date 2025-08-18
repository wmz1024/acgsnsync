import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { shell } from '@tauri-apps/api';

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
  url: string;
}

export function UpdateDialog({ isOpen, onClose, version, url }: UpdateDialogProps) {
  const handleUpdateClick = () => {
    shell.open(url);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>发现新版本!</DialogTitle>
          <DialogDescription>
            新版本 {version} 可用。建议您立即更新以获取最新的功能和修复。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>稍后</Button>
          <Button onClick={handleUpdateClick}>前往下载</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 