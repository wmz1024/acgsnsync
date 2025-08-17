import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SyncConfirmation } from './sync-confirmation';

interface Modpack {
  name: string;
  url: string;
  description: string;
  author: string;
  thumbnail: string;
}

interface ModpackData {
  [key: string]: Modpack;
}

export function SyncMarket() {
  const [modpacks, setModpacks] = useState<ModpackData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModpackUrl, setSelectedModpackUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchModpacks = async () => {
      try {
        const response = await fetch('https://aka.wmz1024.com/modpack.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: ModpackData = await response.json();
        setModpacks(data);
      } catch (e: any) {
        setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

    fetchModpacks();
  }, []);

  const handleSyncClick = (url: string) => {
    setSelectedModpackUrl(url);
  };

  const handleBack = () => {
    setSelectedModpackUrl(null);
  }

  if (selectedModpackUrl) {
    return <SyncConfirmation manifestUrl={selectedModpackUrl} onBack={handleBack} />;
  }

  if (isLoading) {
    return <div className="p-6">正在加载同步市场...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">加载失败: {error}</div>;
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-2xl font-bold mb-4">同步市场</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modpacks && Object.values(modpacks).map((pack) => (
          <Card key={pack.name}>
            <CardHeader>
              <img src={pack.thumbnail} alt={pack.name} className="w-full h-32 object-cover rounded-t-lg" />
              <CardTitle className="pt-4">{pack.name}</CardTitle>
              <CardDescription>作者: {pack.author}</CardDescription>
                </CardHeader>
                <CardContent>
              <p className="text-sm text-muted-foreground">{pack.description}</p>
                </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => handleSyncClick(pack.url)}>同步</Button>
            </CardFooter>
              </Card>
            ))}
      </div>
    </div>
  );
}
