import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface SidebarProps {
  children?: React.ReactNode
  className?: string
}

export function Sidebar({ children, className }: SidebarProps) {
    return (
    <div className={cn("flex h-full w-80 flex-col border-r bg-background", className)}>
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
  }

export function SidebarNav({ items }: SidebarNavProps) {
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
          {item.title}
        </Button>
      ))}
    </nav>
  )
}