import {
  Armchair,
  Baby,
  Bike,
  Briefcase,
  Building2,
  Cat,
  Car,
  Dumbbell,
  Hammer,
  HardHat,
  Home,
  Key,
  Laptop,
  MapPin,
  Palmtree,
  Plug,
  Shirt,
  ShoppingBag,
  Sofa,
  Store,
  Tag,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** מפת שמות אייקונים (כפי שנשמרים ב-DB) לרכיבי lucide. */
const ICONS: Record<string, LucideIcon> = {
  Car,
  Truck,
  Bike,
  Home,
  Building2,
  Key,
  Users,
  Store,
  Palmtree,
  MapPin,
  ShoppingBag,
  Sofa,
  Armchair,
  Laptop,
  Plug,
  Shirt,
  Dumbbell,
  Baby,
  Hammer,
  Wrench,
  Briefcase,
  HardHat,
  Cat,
  Tag,
};

export function CategoryIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Tag;
  return <Icon className={cn("size-5", className)} aria-hidden />;
}
