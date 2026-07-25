import {
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CircleDashed,
  Clipboard,
  ClipboardList,
  Coffee,
  FileText,
  GraduationCap,
  House,
  Kanban,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Palette,
  Presentation,
  Printer,
  Settings,
  Target,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon names are stored as strings (in the database for departments, in
 * nav-config for navigation) so they can be edited without a deploy. This maps
 * them back to components.
 */
const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "building-2": Building2,
  "calendar-days": CalendarDays,
  "calendar-range": CalendarRange,
  "check-circle-2": CheckCircle2,
  "circle-dashed": CircleDashed,
  "clipboard-list": ClipboardList,
  clipboard: Clipboard,
  coffee: Coffee,
  "file-text": FileText,
  "graduation-cap": GraduationCap,
  house: House,
  kanban: Kanban,
  "list-checks": ListChecks,
  mail: Mail,
  "map-pin": MapPin,
  megaphone: Megaphone,
  "message-circle": MessageCircle,
  palette: Palette,
  presentation: Presentation,
  printer: Printer,
  settings: Settings,
  target: Target,
  "trending-up": TrendingUp,
  truck: Truck,
  "user-cog": UserCog,
  users: Users,
  wallet: Wallet,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? CircleDashed;
  return <Icon className={className} />;
}
