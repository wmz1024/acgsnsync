import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Loader2, Download, Play, User, Coffee } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MinecraftVersion {
  id: string;
  type: string;
  url: string;
  time: string;
  release_time: string;
}

interface VersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersion[];
}

interface JavaVersion {
  path: string;
  version: string;
  compatible_mc_versions: string[];
}

interface AuthlibAccount {
  username: string;
  uuid: string;
  access_token: string;
  server_url: string;
}

export function MinecraftLauncher() {
  const { toast } = useToast();
  const [downloadSource, setDownloadSource] = useState<'official' | 'bmclapi'>('bmclapi');
  const [versionManifest, setVersionManifest] = useState<VersionManifest | null>(null);
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [javaVersions, setJavaVersions] = useState<JavaVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [selectedJava, setSelectedJava] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [maxMemory, setMaxMemory] = useState<number>(2048);
  const [minMemory, setMinMemory] = useState<number>(512);
  
  // Authlib-Injector 相关
  const [authlibServerUrl, setAuthlibServerUrl] = useState<string>('');
  const [authlibUsername, setAuthlibUsername] = useState<string>('');
  const [authlibPassword, setAuthlibPassword] = useState<string>('');
  const [authlibAccount, setAuthlibAccount] = useState<AuthlibAccount | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Mod 加载器相关
  const [forgeVersions, setForgeVersions] = useState<string[]>([]);
  const [selectedForge, setSelectedForge] = useState<string>('');
  const [optifineVersions, setOptifineVersions] = useState<string[]>([]);
  const [selectedOptifine, setSelectedOptifine] = useState<string>('');
  const [isInstallingMod, setIsInstallingMod] = useState(false);

  // 版本过滤
  const [versionFilter, setVersionFilter] = useState<'all' | 'release' | 'snapshot'>('release');

  useEffect(() => {
    loadVersionManifest();
    loadInstalledVersions();
    detectJavaVersions();
  }, [downloadSource]);

  const loadVersionManifest = async () => {
    try {
      const manifest = await invoke<VersionManifest>('get_version_manifest', {
        source: downloadSource,
      });
      setVersionManifest(manifest);
    } catch (error) {
      toast({
        title: '获取版本列表失败',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const loadInstalledVersions = async () => {
    try {
      const versions = await invoke<string[]>('get_installed_versions');
      setInstalledVersions(versions);
    } catch (error) {
      console.error('获取已安装版本失败:', error);
    }
  };

  const detectJavaVersions = async () => {
    try {
      const versions = await invoke<JavaVersion[]>('detect_java_versions');
      setJavaVersions(versions);
      if (versions.length > 0) {
        setSelectedJava(versions[0].path);
      }
    } catch (error) {
      toast({
        title: 'Java 检测失败',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const downloadVersion = async (versionId: string, versionUrl: string) => {
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await invoke('download_minecraft_version', {
        versionId,
        versionUrl,
        source: downloadSource,
      });
      toast({
        title: '下载完成',
        description: `版本 ${versionId} 已成功下载`,
      });
      loadInstalledVersions();
    } catch (error) {
      toast({
        title: '下载失败',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const loadForgeVersions = async (mcVersion: string) => {
    try {
      const versions = await invoke<string[]>('get_forge_versions', {
        mcVersion,
      });
      setForgeVersions(versions);
    } catch (error) {
      toast({
        title: '获取 Forge 版本失败',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const installForge = async () => {
    if (!selectedVersion || !selectedForge) {
      toast({
        title: '请选择版本',
        description: '请先选择 Minecraft 版本和 Forge 版本',
        variant: 'destructive',
      });
      return;
    }
    
    setIsInstallingMod(true);
    try {
      await invoke('install_forge', {
        mcVersion: selectedVersion,
        forgeVersion: selectedForge,
      });
      toast({
        title: 'Forge 下载完成',
        description: '请手动运行安装器完成安装',
      });
    } catch (error) {
      toast({
        title: 'Forge 安装失败',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsInstallingMod(false);
    }
  };

  const loadOptifineVersions = async (mcVersion: string) => {
    try {
      const versions = await invoke<string[]>('get_optifine_versions', {
        mcVersion,
      });
      setOptifineVersions(versions);
    } catch (error) {
      toast({
        title: '获取 Optifine 版本失败',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const installOptifine = async () => {
    if (!selectedVersion || !selectedOptifine) {
      toast({
        title: '请选择版本',
        description: '请先选择 Minecraft 版本和 Optifine 版本',
        variant: 'destructive',
      });
      return;
    }
    
    setIsInstallingMod(true);
    try {
      await invoke('install_optifine', {
        mcVersion: selectedVersion,
        optifineType: selectedOptifine,
      });
      toast({
        title: 'Optifine 下载完成',
        description: 'Optifine 已成功下载',
      });
    } catch (error) {
      toast({
        title: 'Optifine 安装失败',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsInstallingMod(false);
    }
  };

  const handleAuthlibLogin = async () => {
    if (!authlibServerUrl || !authlibUsername || !authlibPassword) {
      toast({
        title: '请填写完整信息',
        description: '请填写服务器地址、用户名和密码',
        variant: 'destructive',
      });
      return;
    }

    setIsLoggingIn(true);
    try {
      // 先下载 authlib-injector
      await invoke('download_authlib_injector');
      
      // 然后登录
      const account = await invoke<AuthlibAccount>('authlib_login', {
        serverUrl: authlibServerUrl,
        username: authlibUsername,
        password: authlibPassword,
      });
      setAuthlibAccount(account);
      toast({
        title: '登录成功',
        description: `欢迎回来，${account.username}！`,
      });
    } catch (error) {
      toast({
        title: '登录失败',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const launchGame = async () => {
    if (!selectedVersion) {
      toast({
        title: '请选择版本',
        description: '请先选择要启动的 Minecraft 版本',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedJava) {
      toast({
        title: '请选择 Java',
        description: '请先选择 Java 版本',
        variant: 'destructive',
      });
      return;
    }

    setIsLaunching(true);
    try {
      await invoke('launch_minecraft', {
        options: {
          version: selectedVersion,
          java_path: selectedJava,
          max_memory: maxMemory,
          min_memory: minMemory,
          game_dir: '.minecraft',
          account: authlibAccount,
          mod_loader: null,
        },
      });
      toast({
        title: '游戏启动成功',
        description: 'Minecraft 正在启动...',
      });
    } catch (error) {
      toast({
        title: '启动失败',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const filteredVersions = versionManifest?.versions.filter((v) => {
    if (versionFilter === 'all') return true;
    return v.type === versionFilter;
  }) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Minecraft 启动器</h1>
          <p className="text-muted-foreground">管理和启动你的 Minecraft 游戏</p>
        </div>
        <div className="flex items-center gap-2">
          <Label>下载源:</Label>
          <Select value={downloadSource} onValueChange={(v) => setDownloadSource(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="official">官方源</SelectItem>
              <SelectItem value="bmclapi">BMCLAPI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="launch" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="launch">启动游戏</TabsTrigger>
          <TabsTrigger value="versions">版本管理</TabsTrigger>
          <TabsTrigger value="mods">Mod 加载器</TabsTrigger>
          <TabsTrigger value="account">账号管理</TabsTrigger>
        </TabsList>

        {/* 启动游戏 */}
        <TabsContent value="launch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>启动游戏</CardTitle>
              <CardDescription>选择版本和 Java，然后启动游戏</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>游戏版本</Label>
                  <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择已安装的版本" />
                    </SelectTrigger>
                    <SelectContent>
                      {installedVersions.map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Java 版本</Label>
                  <Select value={selectedJava} onValueChange={setSelectedJava}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择 Java 版本" />
                    </SelectTrigger>
                    <SelectContent>
                      {javaVersions.map((java, idx) => (
                        <SelectItem key={idx} value={java.path}>
                          {java.version} - {java.path}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {javaVersions.length === 0 && (
                    <p className="text-sm text-destructive">未检测到 Java，请先安装 Java</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>最小内存 (MB)</Label>
                    <Input
                      type="number"
                      value={minMemory}
                      onChange={(e) => setMinMemory(parseInt(e.target.value))}
                      min={256}
                      max={maxMemory}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>最大内存 (MB)</Label>
                    <Input
                      type="number"
                      value={maxMemory}
                      onChange={(e) => setMaxMemory(parseInt(e.target.value))}
                      min={minMemory}
                    />
                  </div>
                </div>

                {authlibAccount && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">已登录: {authlibAccount.username}</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={launchGame}
                  disabled={isLaunching || !selectedVersion || !selectedJava}
                  className="w-full"
                  size="lg"
                >
                  {isLaunching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      启动中...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      启动游戏
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 版本管理 */}
        <TabsContent value="versions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>版本管理</CardTitle>
              <CardDescription>下载和管理 Minecraft 版本</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Label>版本类型:</Label>
                <RadioGroup
                  value={versionFilter}
                  onValueChange={(v) => setVersionFilter(v as any)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" />
                    <Label htmlFor="all">全部</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="release" id="release" />
                    <Label htmlFor="release">正式版</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="snapshot" id="snapshot" />
                    <Label htmlFor="snapshot">快照版</Label>
                  </div>
                </RadioGroup>
              </div>

              {isDownloading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">下载中...</span>
                    <span className="text-sm">{downloadProgress}%</span>
                  </div>
                  <Progress value={downloadProgress} />
                </div>
              )}

              <ScrollArea className="h-[400px] border rounded-md p-4">
                <div className="space-y-2">
                  {filteredVersions.map((version) => {
                    const isInstalled = installedVersions.includes(version.id);
                    return (
                      <div
                        key={version.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{version.id}</span>
                            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                              {version.type}
                            </span>
                            {isInstalled && (
                              <span className="text-xs text-green-600 dark:text-green-400 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded">
                                已安装
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(version.release_time).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isInstalled ? 'outline' : 'default'}
                          disabled={isDownloading || isInstalled}
                          onClick={() => downloadVersion(version.id, version.url)}
                        >
                          {isInstalled ? (
                            '已安装'
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              下载
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mod 加载器 */}
        <TabsContent value="mods" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coffee className="h-5 w-5" />
                  Forge
                </CardTitle>
                <CardDescription>安装 Forge Mod 加载器</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Minecraft 版本</Label>
                  <Select
                    value={selectedVersion}
                    onValueChange={(v) => {
                      setSelectedVersion(v);
                      loadForgeVersions(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择 MC 版本" />
                    </SelectTrigger>
                    <SelectContent>
                      {installedVersions.map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Forge 版本</Label>
                  <Select value={selectedForge} onValueChange={setSelectedForge}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择 Forge 版本" />
                    </SelectTrigger>
                    <SelectContent>
                      {forgeVersions.map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={installForge}
                  disabled={isInstallingMod || !selectedVersion || !selectedForge}
                  className="w-full"
                >
                  {isInstallingMod ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      安装中...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      安装 Forge
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optifine</CardTitle>
                <CardDescription>安装 Optifine 优化模组</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Minecraft 版本</Label>
                  <Select
                    value={selectedVersion}
                    onValueChange={(v) => {
                      setSelectedVersion(v);
                      loadOptifineVersions(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择 MC 版本" />
                    </SelectTrigger>
                    <SelectContent>
                      {installedVersions.map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Optifine 版本</Label>
                  <Select value={selectedOptifine} onValueChange={setSelectedOptifine}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择 Optifine 版本" />
                    </SelectTrigger>
                    <SelectContent>
                      {optifineVersions.map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={installOptifine}
                  disabled={isInstallingMod || !selectedVersion || !selectedOptifine}
                  className="w-full"
                >
                  {isInstallingMod ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      安装中...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      安装 Optifine
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 账号管理 */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Authlib-Injector 登录</CardTitle>
              <CardDescription>使用第三方验证服务器登录</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {authlibAccount ? (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">用户名</p>
                        <p className="text-lg">{authlibAccount.username}</p>
                      </div>
                      <User className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">UUID</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {authlibAccount.uuid}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">服务器</p>
                      <p className="text-sm text-muted-foreground">{authlibAccount.server_url}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setAuthlibAccount(null)}
                  >
                    退出登录
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="authlib-server">验证服务器地址</Label>
                    <Input
                      id="authlib-server"
                      placeholder="https://example.com/api/yggdrasil"
                      value={authlibServerUrl}
                      onChange={(e) => setAuthlibServerUrl(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="authlib-username">用户名/邮箱</Label>
                    <Input
                      id="authlib-username"
                      placeholder="username"
                      value={authlibUsername}
                      onChange={(e) => setAuthlibUsername(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="authlib-password">密码</Label>
                    <Input
                      id="authlib-password"
                      type="password"
                      placeholder="password"
                      value={authlibPassword}
                      onChange={(e) => setAuthlibPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleAuthlibLogin}
                    disabled={isLoggingIn}
                    className="w-full"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登录中...
                      </>
                    ) : (
                      '登录'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

