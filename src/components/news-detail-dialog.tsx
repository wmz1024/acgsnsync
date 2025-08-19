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
import remarkBreaks from 'remark-breaks';
import remarkEmoji from 'remark-emoji';
import { invoke } from '@tauri-apps/api';
import React, { ImgHTMLAttributes } from 'react';

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

    const components = {
        img: ({node, ...props}: ImgHTMLAttributes<HTMLImageElement> & { node?: any }) => {
            const [src, setSrc] = React.useState(props.src);
            React.useEffect(() => {
                if (props.src && !props.src.startsWith('data:')) {
                    invoke('proxy_fetch_image', { url: props.src })
                        .then(data => setSrc(data as string))
                        .catch(console.error);
                }
            }, [props.src]);
            return <img {...props} src={src} alt={props.alt || ''} />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-4/5 flex flex-col">
                <DialogHeader>
                    <DialogTitle>{newsItem.title}</DialogTitle>
                    <DialogDescription>{newsItem.time}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow pr-4 -mr-4">
                    <div className="prose dark:prose-invert max-w-none">
                        <ReactMarkdown
                            components={components}
                            remarkPlugins={[remarkGfm, remarkBreaks, remarkEmoji]}
                        >
                            {newsItem.content.replace(/\\n/g, '\n')}
                        </ReactMarkdown>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
} 