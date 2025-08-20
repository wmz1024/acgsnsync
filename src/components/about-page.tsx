import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/components/theme-provider';

export function AboutPage() {
    const { theme } = useTheme();
    const logoSrc = theme === 'dark' ? '/logo.svg' : '/logo.png';

    return (
        <div className="p-4 flex flex-col items-center">
            <Card className="w-full max-w-2xl">
                <CardHeader className="flex flex-col items-center text-center">
                    <img src={logoSrc} alt="ACGStationSync Logo" className=" h-32 mb-4" />
                    <CardTitle className="text-xl">ACGStation Sync</CardTitle>
                </CardHeader>
                <CardContent className="">
                    <p className="mb-4">
                        ACGStation Sync 是一款用于同步游戏模组和配置的强大工具，旨在为用户提供无缝、高效的体验。
                    </p>
                    <p>Copyright © 2025 MZCompute GmbH.</p><br></br><br></br>
                    <span><a href="https://www.acgstation.com/d/9-acgstation-sync-privacy-policy-user-agreement">隐私政策</a> | <a href="https://www.acgstation.com/d/9-acgstation-sync-privacy-policy-user-agreement">用户协议</a></span>
                </CardContent>
            </Card>
        </div>
    );
} 