import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAtom } from 'jotai'
import { authDataAtom, avatarAtom, isSidebarCollapsedAtom } from '@/atoms'
import { invoke } from '@tauri-apps/api'
import { useEffect } from "react"
import { LogIn } from "lucide-react"

interface SidebarProps {
  children?: React.ReactNode
  className?: string
  isCollapsed: boolean
}

export function Sidebar({ children, className, isCollapsed }: SidebarProps) {
    return (
    <div className={cn("flex h-full flex-col border-r bg-background transition-all duration-300", isCollapsed ? "w-20" : "w-80", className)}>
          {children}
        </div>
      )
    }

interface SidebarHeaderProps {
  children: React.ReactNode
  className?: string
}

export function SidebarHeader({ children, className }: SidebarHeaderProps) {
    return (
    <div className={cn("flex h-16 items-center border-b px-6", className)}>
            {children}
          </div>
  )
}

interface SidebarContentProps {
  children: React.ReactNode
  className?: string
}

export function SidebarContent({ children, className }: SidebarContentProps) {
  return (
    <div className={cn("flex-1 overflow-auto p-4", className)}>
      {children}
    </div>
  )
}

interface SidebarNavProps {
  items: Array<{
    title: string
    href?: string
    icon?: React.ReactNode
    isActive?: boolean
    onClick?: () => void
  }>
  isCollapsed: boolean
  }

export function SidebarNav({ items, isCollapsed }: SidebarNavProps) {
  return (
    <nav className="space-y-2">
      {items.map((item, index) => (
        <Button
          key={index}
          variant={item.isActive ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={item.onClick}
        >
          {item.icon && <span className="mr-2">{item.icon}</span>}
          {!isCollapsed && item.title}
        </Button>
      ))}
    </nav>
  )
}


export function SidebarFooter({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn("p-2 border-t", className)}>
            {children}
        </div>
    )
}

export function AuthSection() {
    const [authData, setAuthData] = useAtom(authDataAtom);
    const [avatar, setAvatar] = useAtom(avatarAtom);
    const [isCollapsed] = useAtom(isSidebarCollapsedAtom);

    useEffect(() => {
        const fetchAvatar = async () => {
          if (authData?.user.uid && !avatar) {
            try {
              const avatarData = await invoke<string>('get_user_avatar', { uid: authData.user.uid });
              setAvatar(avatarData);
            } catch (e) {
              console.error("Failed to fetch avatar:", e);
            }
          }
        };
        fetchAvatar();
    }, [authData, avatar, setAvatar]);

    const handleLogin = () => {
        invoke('start_login');
    };

    const handleLogout = () => {
        localStorage.removeItem('authData');
        setAuthData(null);
        setAvatar(null);
    };

    if (isCollapsed) {
        if (authData && authData.user) {
            return (
                <div className="flex justify-center p-2">
                    {avatar ? (
                        <img src={avatar} alt="User Avatar" className="w-10 h-10" />
                    ) : (
                        <div className="w-10 h-10 bg-muted animate-pulse" />
                    )}
                </div>
            )
        }
        return (
            <div className="flex justify-center p-2">
                 <Button variant="outline" size="icon" className="w-10 h-10" onClick={handleLogin}>
                    <LogIn className="h-4 w-4" />
                </Button>
            </div>
        )
    }

    if (authData && authData.user) {
        return (
            <div className="flex items-center space-x-3 p-2">
                {avatar ? (
                    <img src={avatar} alt="User Avatar" className="w-10 h-10" />
                ) : (
                    <div className="w-10 h-10 bg-muted animate-pulse" />
                )}
                <div className="flex-1">
                    <p className="font-semibold text-sm">{authData.user.nickname}</p>
                    <button onClick={handleLogout} className="text-xs text-muted-foreground hover:underline">
                        退出登录
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-2">
            <Button variant="outline" className="w-full justify-center" onClick={handleLogin}>
                <LogIn className="mr-2 h-4 w-4" />
                通过 ACGS ID 登录
            </Button>
        </div>
    )
}