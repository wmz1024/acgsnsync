import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { X, Plus } from 'lucide-react';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api';

interface ExclusionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  targetDir: string;
  initialExcludedFiles: string[];
  onExclusionChange: (updatedList: string[]) => void;
}

export function ExclusionEditor({
  isOpen,
  onClose,
  targetDir,
  initialExcludedFiles,
  onExclusionChange,
}: ExclusionEditorProps) {
  const [excludedFiles, setExcludedFiles] = useState<string[]>(initialExcludedFiles);

  useEffect(() => {
    setExcludedFiles(initialExcludedFiles);
  }, [initialExcludedFiles]);

  const handleAddFiles = async () => {
    const selected = await open({
      multiple: true,
      title: 'Select files to exclude',
      defaultPath: targetDir,
    });

    if (Array.isArray(selected)) {
      const newExclusions = selected
        .map(path => {
          if (path.startsWith(targetDir)) {
            return path.substring(targetDir.length + 1).replace(/\\/g, '/');
          }
          return null;
        })
        .filter((path): path is string => path !== null);

      setExcludedFiles(prev => [...new Set([...prev, ...newExclusions])]);
    }
  };

  const handleRemoveFile = (fileToRemove: string) => {
    setExcludedFiles(prev => prev.filter(file => file !== fileToRemove));
  };

  const handleSaveChanges = async () => {
    try {
      await invoke('save_exclusion_list', { targetDir, excludedFiles });
      onExclusionChange(excludedFiles);
      onClose();
    } catch (e) {
      console.error('Failed to save exclusion list:', e);
      // You might want to show an error to the user here
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Manage Exclusion List</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="flex justify-end mb-4">
            <Button onClick={handleAddFiles} size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Files
            </Button>
          </div>
          <ScrollArea className="h-72 w-full rounded-md border">
            <div className="p-4">
              {excludedFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">No files are excluded.</p>
              ) : (
                <ul className="space-y-2">
                  {excludedFiles.map(file => (
                    <li key={file} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                      <span>{file}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(file)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSaveChanges}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 