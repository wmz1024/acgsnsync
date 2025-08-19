import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { invoke } from '@tauri-apps/api';
import { Folder, File as FileIcon } from 'lucide-react';

interface FileNode {
    path: string;
    name: string;
    isDirectory: boolean;
    children?: FileNode[];
}

interface ExclusionManagerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    basePath: string;
    onSave: (excludedPaths: string[]) => void;
    initialExclusions: string[];
}

async function getFileTree(path: string): Promise<FileNode[]> {
    const contents: any[] = await invoke("get_folder_contents", { path });
    const nodes: FileNode[] = [];
    for (const item of contents) {
        let children: FileNode[] | undefined;
        if (item.isDirectory) {
            children = await getFileTree(item.path);
        }
        nodes.push({ ...item, children });
    }
    return nodes;
}

const FileTreeItem = ({ node, excludedPaths, onToggle }: { node: FileNode; excludedPaths: Set<string>; onToggle: (path: string, isExcluded: boolean) => void; }) => {
    const isExcluded = excludedPaths.has(node.path);

    return (
        <div className="ml-4">
            <div className="flex items-center space-x-2 my-1">
                <Checkbox
                    id={node.path}
                    checked={!isExcluded}
                    onCheckedChange={(checked) => onToggle(node.path, !checked)}
                />
                {node.isDirectory ? <Folder className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
                <label htmlFor={node.path} className="text-sm">{node.name}</label>
            </div>
            {node.children && (
                <div>
                    {node.children.map(child => <FileTreeItem key={child.path} node={child} excludedPaths={excludedPaths} onToggle={onToggle} />)}
                </div>
            )}
        </div>
    );
};

export function ExclusionManagerDialog({ isOpen, onClose, basePath, onSave, initialExclusions }: ExclusionManagerDialogProps) {
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [excludedPaths, setExcludedPaths] = useState(new Set(initialExclusions));

    useEffect(() => {
        if (isOpen && basePath) {
            getFileTree(basePath).then(setFileTree);
        }
    }, [isOpen, basePath]);

    const handleToggle = (path: string, isNowExcluded: boolean) => {
        setExcludedPaths(prev => {
            const newSet = new Set(prev);
            if (isNowExcluded) {
                newSet.add(path);
            } else {
                newSet.delete(path);
            }
            return newSet;
        });
    };

    const handleSave = () => {
        onSave(Array.from(excludedPaths));
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>管理排除项: {basePath}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-96">
                    <div className="p-4">
                        {fileTree.map(node => <FileTreeItem key={node.path} node={node} excludedPaths={excludedPaths} onToggle={handleToggle} />)}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>取消</Button>
                    <Button onClick={handleSave}>保存</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 