import {
  Home,
  FolderOpen,
  FileText,
  Calendar,
  ListTodo,
  Megaphone,
  BarChart3,
  Shield,
  User,
  Settings,
  LucideIcon
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  folder: FolderOpen,
  file: FileText,
  calendar: Calendar,
  check: ListTodo,
  megaphone: Megaphone,
  chart: BarChart3,
  shield: Shield,
  user: User,
  settings: Settings,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = ICON_MAP[name] ?? FolderOpen;
  
  return (
    <IconComponent 
      className={`size-5 shrink-0 ${className ?? ""}`}
      strokeWidth={1.5}
      aria-hidden="true"
    />
  );
}
