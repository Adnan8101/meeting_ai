"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  gradient: string;
  iconColor: string;
}

interface MenuBarProps {
  className?: string;
  items: MenuItem[];
  activeItem?: string;
  onItemClick?: (item: MenuItem) => void;
}

const itemVariants = {
  initial: { rotateX: 0, opacity: 1 },
  hover: { rotateX: -90, opacity: 0 },
};

const backVariants = {
  initial: { rotateX: 90, opacity: 0 },
  hover: { rotateX: 0, opacity: 1 },
};

const glowVariants = {
  initial: { opacity: 0, scale: 0.8 },
  hover: {
    opacity: 1,
    scale: 2,
    transition: {
      opacity: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
      scale: { duration: 0.45, type: "spring", stiffness: 300, damping: 25 },
    },
  },
};

const navGlowVariants = {
  initial: { opacity: 0 },
  hover: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const sharedTransition = {
  type: "spring",
  stiffness: 100,
  damping: 20,
  duration: 0.45,
};

export const MenuBar = React.forwardRef<HTMLElement, MenuBarProps>(
  ({ className, items, activeItem, onItemClick }, ref) => {
    return (
      <motion.nav
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-white/15 to-white/5 p-2 shadow-[0_20px_50px_-28px_rgba(255,255,255,0.5)] backdrop-blur-xl",
          className
        )}
        initial="initial"
        whileHover="hover"
      >
        <motion.div
          className="pointer-events-none absolute -inset-2 z-0 rounded-3xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.22)_0%,rgba(180,200,255,0.12)_35%,rgba(0,0,0,0)_75%)]"
          variants={navGlowVariants}
        />
        <ul className="relative z-10 flex items-center gap-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.label === activeItem;

            return (
              <motion.li key={item.label} className="relative">
                <button onClick={() => onItemClick?.(item)} className="block w-full" type="button">
                  <motion.div
                    className="group relative block overflow-visible rounded-xl"
                    style={{ perspective: "600px" }}
                    whileHover="hover"
                    initial="initial"
                  >
                    <motion.div
                      className="pointer-events-none absolute inset-0 z-0 rounded-xl"
                      variants={glowVariants}
                      animate={isActive ? "hover" : "initial"}
                      style={{
                        background: item.gradient,
                        opacity: isActive ? 1 : 0,
                      }}
                    />
                    <motion.div
                      className={cn(
                        "relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors",
                        isActive
                          ? "text-white"
                          : "text-white/70 group-hover:text-white"
                      )}
                      variants={itemVariants}
                      transition={sharedTransition}
                      style={{
                        transformStyle: "preserve-3d",
                        transformOrigin: "center bottom",
                      }}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? item.iconColor : "text-white/80")} />
                      <span>{item.label}</span>
                    </motion.div>
                    <motion.div
                      className={cn(
                        "absolute inset-0 z-10 flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors",
                        isActive
                          ? "text-white"
                          : "text-white/70 group-hover:text-white"
                      )}
                      variants={backVariants}
                      transition={sharedTransition}
                      style={{
                        transformStyle: "preserve-3d",
                        transformOrigin: "center top",
                        rotateX: 90,
                      }}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? item.iconColor : "text-white/80")} />
                      <span>{item.label}</span>
                    </motion.div>
                  </motion.div>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </motion.nav>
    );
  }
);

MenuBar.displayName = "MenuBar";
