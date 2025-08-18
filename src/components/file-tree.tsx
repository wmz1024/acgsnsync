import React, { useState } from 'react';
import { ChevronRight, Folder, File as FileIcon, RefreshCw, ArrowDown, XCircle, CheckCircle } from 'lucide-react';

export enum FileStatus {
    Unchanged = "Unchanged",
    New = "New",
    Modified = "Modified",
    Extra = "Extra",
    Excluded = "Excluded",
    ForceUpdate = "ForceUpdate",
}

export interface DiffFile {
    path: string;
    status: FileStatus;
}

export interface TreeNode {
  name: string;
  path: string;
  status?: FileStatus;
  children?: TreeNode[];
}

interface FileTreeProps {
  nodes: TreeNode[];
}

interface TreeNodeProps {
  node: TreeNode;
  level: number;
}

// A map to get icons and styles based on file status
const statusDisplay = {
  [FileStatus.New]: { Icon: ArrowDown, className: "text-green-600", description: "New" },
  [FileStatus.Modified]: { Icon: RefreshCw, className: "text-blue-600", description: "Modified" },
  [FileStatus.ForceUpdate]: { Icon: RefreshCw, className: "text-orange-600", description: "Force Update" },
  [FileStatus.Extra]: { Icon: XCircle, className: "text-red-600", description: "Extra" },
  [FileStatus.Unchanged]: { Icon: CheckCircle, className: "text-gray-500", description: "Unchanged" },
  [FileStatus.Excluded]: { Icon: XCircle, className: "text-gray-500 line-through", description: "Excluded" },
};

const NodeDisplay: React.FC<TreeNodeProps> = ({ node, level }) => {
  const isDirectory = node.children && node.children.length > 0;
  const [isOpen, setIsOpen] = useState(true);

  const { Icon, className, description } = node.status ? statusDisplay[node.status] : { Icon: FileIcon, className: "", description: "" };

  return (
    <div>
      <div 
        className={`flex items-center p-1 rounded-md hover:bg-muted`}
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={() => isDirectory && setIsOpen(!isOpen)}
      >
        {isDirectory && (
          <ChevronRight className={`w-4 h-4 mr-2 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        )}
        
        {node.status ? (
          <Icon className={`w-4 h-4 mr-2 ${className}`} />
        ) : (
          isDirectory ? <Folder className="w-4 h-4 mr-2" /> : <FileIcon className="w-4 h-4 mr-2" />
        )}

        <span className={`text-sm flex-grow ${className}`}>{node.name}</span>
        {description && <span className={`text-xs px-2 py-1 rounded-full ${className}`}>{description}</span>}
      </div>
      {isOpen && isDirectory && (
        <div>
          {node.children?.map(child => <NodeDisplay key={child.path} node={child} level={level + 1} />)}
        </div>
      )}
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ nodes }) => {
  return (
    <div className="space-y-1">
      {nodes.map(node => <NodeDisplay key={node.path} node={node} level={0} />)}
    </div>
  );
};

export const buildFileTree = (files: DiffFile[]): TreeNode[] => {
    const root: TreeNode = { name: 'root', path: '', children: [] };

    const findOrCreateNode = (path: string[], parent: TreeNode): TreeNode => {
        if (path.length === 0) return parent;

        const name = path.shift()!;
        let node = parent.children?.find(c => c.name === name);

        if (!node) {
            const currentPath = parent.path ? `${parent.path}/${name}` : name;
            node = { name, path: currentPath, children: [] };
            parent.children?.push(node);
        }
        
        return findOrCreateNode(path, node);
    };

    files.forEach(file => {
        const pathSegments = file.path.split('/');
        const parentNode = findOrCreateNode(pathSegments.slice(0, -1), root);
        
        const fileName = pathSegments[pathSegments.length - 1];
        parentNode.children?.push({
            name: fileName,
            path: file.path,
            status: file.status,
            children: [] 
        });
    });
    
    // Sort children at each level: folders first, then files, alphabetically.
    const sortTree = (node: TreeNode) => {
        if (!node.children) return;

        node.children.sort((a, b) => {
            const aIsDirectory = a.children && a.children.length > 0;
            const bIsDirectory = b.children && b.children.length > 0;
            if (aIsDirectory && !bIsDirectory) return -1;
            if (!aIsDirectory && bIsDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        node.children.forEach(sortTree);
    };
    
    sortTree(root);
    return root.children || [];
}; 