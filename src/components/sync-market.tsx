import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from 'lucide-react';
import { CustomSyncImporter } from './custom-sync-importer';
import { invoke } from '@tauri-apps/api';
import { ProxiedImage } from './proxied-image';

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

interface SyncMarketProps {
    onSync: (url: string, localPackagePath?: string, useLocalFiles?: boolean) => void;
}

export function SyncMarket({ onSync }: SyncMarketProps) {
  const [modpacks, setModpacks] = useState<ModpackData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCustomSyncOpen, setIsCustomSyncOpen] = useState(false);

  useEffect(() => {
    const fetchModpacks = async () => {
      try {
        const data = await invoke<ModpackData>('fetch_modpacks');
        setModpacks(data);
      } catch (e: any) {
        setError(e.toString());
    } finally {
      setIsLoading(false);
    }
  };

    fetchModpacks();
  }, []);

  if (isLoading) {
    return <div className="p-6">正在加载同步市场...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">加载失败: {error}</div>;
  }

  return (
    <div className="p-6 h-full overflow-auto">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">同步市场</h2>
            <Button onClick={() => setIsCustomSyncOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                同步自定义包
            </Button>
        </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modpacks && Object.values(modpacks).map((pack) => (
          <Card key={pack.name}>
            <CardHeader>
              <ProxiedImage 
                src={pack.thumbnail} 
                alt={pack.name} 
                className="w-full h-32 object-cover rounded-t-lg" 
              />
              <CardTitle className="pt-4">{pack.name}</CardTitle>
              <CardDescription>作者: {pack.author}</CardDescription>
                </CardHeader>
                <CardContent>
              <p className="text-sm text-muted-foreground">{pack.description}</p>
                </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => onSync(pack.url)}>同步</Button>
            </CardFooter>
              </Card>
            ))}
      </div>
      <CustomSyncImporter 
        isOpen={isCustomSyncOpen}
        onClose={() => setIsCustomSyncOpen(false)}
        onSync={onSync}
      />
    </div>
  );
}
