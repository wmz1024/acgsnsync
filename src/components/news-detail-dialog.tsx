import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ProxiedImage } from './proxied-image';

interface NewsItem {
    title: string;
    time: string;
    content: string;
}

interface NewsDetailDialogProps {
    isOpen: boolean;
    onClose: () => void;
    newsItem: NewsItem | null;
}

export function NewsDetailDialog({ isOpen, onClose, newsItem }: NewsDetailDialogProps) {
    if (!newsItem) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{newsItem.title}</DialogTitle>
                    <DialogDescription>{newsItem.time}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-96 w-full">
                    <div className="prose dark:prose-invert max-w-none p-4">
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                                img: ({node, ...props}) => <ProxiedImage {...props} />
                            }}
                        >
                            {newsItem.content.replace(/\\n/g, '\n')}
                        </ReactMarkdown>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
} 