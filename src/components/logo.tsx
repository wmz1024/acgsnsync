import { useTheme } from './theme-provider';

export function Logo() {
  const { theme } = useTheme();

  if (theme === 'dark') {
    return <img src="/logo.svg" alt="logo" className="h-8 w-auto" />;
  }
  
  return <img src="/logo.png" alt="logo" className="h-8 w-auto" />;
} 