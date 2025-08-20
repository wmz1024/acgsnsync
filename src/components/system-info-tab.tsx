import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from './ui/button';

interface OsInfo {
    os_type: string;
    os_version: string;
    hostname: string;
    uptime: number;
}

interface CpuInfo {
    brand: string;
    frequency: number;
    cores: number;
}

interface MemoryInfo {
    total_memory: number;
    used_memory: number;
    total_swap: number;
    used_swap: number;
}

interface DiskInfo {
    name: string;
    file_system: string;
    total_space: number;
    available_space: number;
}

interface NetworkInfo {
    interface_name: string;
    mac_address: string;
    received: number;
    transmitted: number;
}

interface ComponentInfo {
    label: string;
}

interface SystemInfo {
    os_info: OsInfo;
    cpu_info: CpuInfo;
    memory_info: MemoryInfo;
    disk_info: DiskInfo[];
    network_info: NetworkInfo[];
    component_info: ComponentInfo[];
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

export function SystemInfoTab() {
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState("");
    const [logsLoading, setLogsLoading] = useState(false);

    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            const logContent = await invoke<string>('read_logs');
            setLogs(logContent);
        } catch (err) {
            setLogs(err as string);
        } finally {
            setLogsLoading(false);
        }
    };

    useEffect(() => {
        const fetchSystemInfo = async () => {
            try {
                const info = await invoke<SystemInfo>('get_system_info');
                setSystemInfo(info);
            } catch (err) {
                setError(err as string);
            } finally {
                setLoading(false);
            }
        };

        fetchSystemInfo();
    }, []);

    if (loading) {
        return <div className="p-4">Loading system information...</div>;
    }

    if (error) {
        return <div className="p-4 text-red-500">错误: {error}</div>;
    }

    if (!systemInfo) {
        return <div className="p-4">无可用系统信息.</div>;
    }

    const motherboards = systemInfo.component_info.filter(c => c.label.toLowerCase().includes('motherboard') || c.label.toLowerCase().includes('mainboard'));
    const gpus = systemInfo.component_info.filter(c => c.label.toLowerCase().includes('vga') || c.label.toLowerCase().includes('display') || c.label.toLowerCase().includes('graphics'));

    return (
        <ScrollArea className="h-full p-4">
            <h1 className="text-2xl font-bold mb-4">系统信息</h1>
            <Accordion type="multiple" defaultValue={['system', 'cpu', 'memory']} className="space-y-4">
                <AccordionItem value="system">
                    <AccordionTrigger>系统信息</AccordionTrigger>
                    <AccordionContent>
                        <Card>
                            <CardContent className="pt-6">
                                <p><strong>操作系统:</strong> {systemInfo.os_info.os_type} {systemInfo.os_info.os_version}</p>
                                <p><strong>主机名:</strong> {systemInfo.os_info.hostname}</p>
                                <p><strong>运行时间:</strong> {formatUptime(systemInfo.os_info.uptime)}</p>
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="cpu">
                    <AccordionTrigger>处理器</AccordionTrigger>
                    <AccordionContent>
                        <Card>
                            <CardContent className="pt-6">
                                <p><strong>品牌:</strong> {systemInfo.cpu_info.brand}</p>
                                <p><strong>频率:</strong> {systemInfo.cpu_info.frequency} MHz</p>
                                <p><strong>核心数:</strong> {systemInfo.cpu_info.cores}</p>
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="memory">
                    <AccordionTrigger>内存</AccordionTrigger>
                    <AccordionContent>
                        <Card>
                            <CardContent className="pt-6">
                                <p><strong>总计:</strong> {formatBytes(systemInfo.memory_info.total_memory)}</p>
                                <p><strong>已用:</strong> {formatBytes(systemInfo.memory_info.used_memory)}</p>
                                <p><strong>总交换空间:</strong> {formatBytes(systemInfo.memory_info.total_swap)}</p>
                                <p><strong>已用交换空间:</strong> {formatBytes(systemInfo.memory_info.used_swap)}</p>
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>

                {motherboards.length > 0 && (
                    <AccordionItem value="motherboard">
                        <AccordionTrigger>主板</AccordionTrigger>
                        <AccordionContent>
                            {motherboards.map((board, index) => (
                                <Card key={index} className="mb-4">
                                    <CardContent className="pt-6">
                                        <p><strong>型号:</strong> {board.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                )}

                {gpus.length > 0 && (
                     <AccordionItem value="gpu">
                        <AccordionTrigger>显卡</AccordionTrigger>
                        <AccordionContent>
                            {gpus.map((gpu, index) => (
                                <Card key={index} className="mb-4">
                                    <CardContent className="pt-6">
                                        <p><strong>型号:</strong> {gpu.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                )}

                <AccordionItem value="disks">
                    <AccordionTrigger>硬盘</AccordionTrigger>
                    <AccordionContent>
                        {systemInfo.disk_info.map((disk, index) => (
                            <Card key={index} className="mb-4">
                                <CardHeader>
                                    <CardTitle>{disk.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p><strong>文件系统:</strong> {disk.file_system}</p>
                                    <p><strong>总空间:</strong> {formatBytes(disk.total_space)}</p>
                                    <p><strong>可用空间:</strong> {formatBytes(disk.available_space)}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="networks">
                    <AccordionTrigger>网卡</AccordionTrigger>
                    <AccordionContent>
                        {systemInfo.network_info.map((net, index) => (
                            <Card key={index} className="mb-4">
                                <CardHeader>
                                    <CardTitle>{net.interface_name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p><strong>MAC 地址:</strong> {net.mac_address}</p>
                                    <p><strong>已接收:</strong> {formatBytes(net.received)}</p>
                                    <p><strong>已发送:</strong> {formatBytes(net.transmitted)}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="logs">
                    <AccordionTrigger>应用日志</AccordionTrigger>
                    <AccordionContent>
                        <Card>
                            <CardHeader>
                                <Button onClick={fetchLogs} disabled={logsLoading}>
                                    {logsLoading ? '正在刷新...' : '刷新日志'}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-64 w-full bg-muted p-2 rounded-md">
                                    <pre className="text-sm">{logs || '点击刷新按钮获取日志'}</pre>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </ScrollArea>
    );
} 