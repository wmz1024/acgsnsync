import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { invoke } from '@tauri-apps/api';
import { NewsDetailDialog } from './news-detail-dialog';

interface NewsItem {
  title: string;
  time: string;
  content: string;
}

export function HomePage() {
  const [userName, setUserName] = useState('User');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const name = await invoke<string>('get_username');
        setUserName(name);
      } catch (e) {
        console.error("Could not get username", e);
      }
    };

    const fetchNews = async () => {
      try {
        const data = await invoke<NewsItem[]>('fetch_news');
        setNews(data);
      } catch (e: any) {
        setError(e.toString());
      }
    };

    fetchUserName();
    fetchNews();
  }, []);

  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-3xl font-bold mb-4">欢迎, {userName}</h1>
      <div className="flex-grow flex flex-col">
        <Card>
            <CardHeader>
            <CardTitle>最新消息</CardTitle>
            <CardDescription>来自ACGStation的最新动态和通知。</CardDescription>
            </CardHeader>
            <CardContent>
            <ScrollArea className="h-[calc(100vh-14rem)]">
                <div className="space-y-4">
                {error && <p className="text-red-500">无法加载新闻: {error}</p>}
                {news.length > 0 ? (
                    news.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                        <h3 
                            className="font-semibold text-lg cursor-pointer hover:underline"
                            onClick={() => setSelectedNews(item)}
                        >
                            {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">{item.time}</p>
                    </div>
                    ))
                ) : (
                    !error && <p>正在加载新闻...</p>
                )}
                </div>
            </ScrollArea>
            </CardContent>
        </Card>
      </div>
      <NewsDetailDialog 
        isOpen={!!selectedNews}
        onClose={() => setSelectedNews(null)}
        newsItem={selectedNews}
      />
    </div>
  );
} 