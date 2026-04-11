"use client";

import { useMemo, useState } from "react";
import { Bell, Home, Settings, User } from "lucide-react";
import { MenuBar, type MenuItem } from "@/components/ui/glow-menu";

export function MenuBarDemo() {
  const [activeItem, setActiveItem] = useState<string>("Home");

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        icon: Home,
        label: "Home",
        href: "#",
        gradient:
          "radial-gradient(circle, rgba(59,130,246,0.25) 0%, rgba(37,99,235,0.08) 55%, rgba(29,78,216,0) 100%)",
        iconColor: "text-blue-300",
      },
      {
        icon: Bell,
        label: "Notifications",
        href: "#",
        gradient:
          "radial-gradient(circle, rgba(249,115,22,0.25) 0%, rgba(234,88,12,0.08) 55%, rgba(194,65,12,0) 100%)",
        iconColor: "text-orange-300",
      },
      {
        icon: Settings,
        label: "Settings",
        href: "#",
        gradient:
          "radial-gradient(circle, rgba(34,197,94,0.25) 0%, rgba(22,163,74,0.08) 55%, rgba(21,128,61,0) 100%)",
        iconColor: "text-green-300",
      },
      {
        icon: User,
        label: "Profile",
        href: "#",
        gradient:
          "radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(220,38,38,0.08) 55%, rgba(185,28,28,0) 100%)",
        iconColor: "text-red-300",
      },
    ],
    []
  );

  return <MenuBar items={menuItems} activeItem={activeItem} onItemClick={(item) => setActiveItem(item.label)} />;
}
