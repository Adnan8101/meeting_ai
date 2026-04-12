"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type ElementType,
  type MouseEvent,
} from "react";
import {
  ArrowRight,
  Link as LinkIcon,
  Lock,
  Unlock,
  X,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
  includes?: string[];
  howItWorks?: string;
  progressLabel?: string;
  step?: number;
  totalSteps?: number;
  route?: string;
  requiresAuth?: boolean;
  routeLabel?: string;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
  /** degrees per second (clockwise) */
  rotationSpeed?: number;
  heightClassName?: string;
}

// ─── Tiny status chip ────────────────────────────────────────────────────────
function StatusChip({ status }: { status: TimelineItem["status"] }) {
  const map = {
    completed: { label: "Complete", cls: "bg-white text-black" },
    "in-progress": { label: "In Progress", cls: "bg-white/15 text-white" },
    pending: { label: "Pending", cls: "bg-white/8 text-white/50" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Minimalist modal ─────────────────────────────────────────────────────────
function FeatureModal({
  item,
  onClose,
  onNavigate,
  isAuthenticated,
  authResolved,
  onSelectRelated,
  timelineData,
}: {
  item: TimelineItem;
  onClose: () => void;
  onNavigate: (item: TimelineItem) => void;
  isAuthenticated: boolean;
  authResolved: boolean;
  onSelectRelated: (id: number) => void;
  timelineData: TimelineItem[];
}) {
  // Animate in
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const Icon = item.icon;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        transition: "opacity 220ms ease",
        opacity: visible ? 1 : 0,
      }}
    >
      <Card
        className="relative w-full max-w-sm border-white/15 bg-[#0a0a0b] text-white shadow-2xl"
        style={{
          transition: "transform 260ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease",
          transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.96)",
          opacity: visible ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X size={13} />
        </button>

        <CardHeader className="pb-3 pt-5">
          {/* Icon + title row */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8">
              <Icon size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <StatusChip status={item.status} />
                <span className="text-[11px] text-white/35">{item.date}</span>
              </div>
              <CardTitle className="mt-1 text-base leading-snug tracking-tight">
                {item.title}
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-5">
          {/* Description */}
          <p className="text-sm leading-relaxed text-white/70">{item.content}</p>

          {/* Progress bar */}
          <div className="rounded-lg border border-white/8 bg-black/40 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-white/50">
                <Zap size={10} />
                {item.progressLabel || "Execution Progress"}
              </span>
              <span className="font-mono text-white/60">{item.energy}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-700"
                style={{ width: `${item.energy}%` }}
              />
            </div>
          </div>

          {/* Includes */}
          {item.includes && item.includes.length > 0 && (
            <ul className="space-y-1.5">
              {item.includes.map((pt) => (
                <li key={pt} className="flex items-start gap-2 text-sm text-white/65">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
                  {pt}
                </li>
              ))}
            </ul>
          )}

          {/* Connected nodes */}
          {item.relatedIds.length > 0 && (
            <div className="border-t border-white/8 pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/35">
                <LinkIcon size={10} /> Connected
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.relatedIds.map((rid) => {
                  const rel = timelineData.find((i) => i.id === rid);
                  if (!rel) return null;
                  return (
                    <button
                      key={rid}
                      className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                      onClick={() => onSelectRelated(rid)}
                    >
                      {rel.title} <ArrowRight size={9} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Access + CTA */}
          <div className="border-t border-white/8 pt-3">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
              {item.requiresAuth ? (
                <><Lock size={10} /> Login required</>
              ) : (
                <><Unlock size={10} /> Public feature</>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="h-8 flex-1 bg-white text-xs text-black hover:bg-zinc-100"
                onClick={() => onNavigate(item)}
                disabled={item.requiresAuth && !authResolved}
              >
                {item.requiresAuth && !isAuthenticated
                  ? "Go To Login"
                  : item.routeLabel || "Open Feature"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 border-white/15 bg-transparent text-xs text-white hover:bg-white/10"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RadialOrbitalTimeline({
  timelineData,
  rotationSpeed = 18, // degrees per second, clockwise (right→left on top arc)
  heightClassName = "h-[34rem] md:h-[46rem]",
}: RadialOrbitalTimelineProps) {
  const navigate = useNavigate();

  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const orbitRadius = isMobile ? 120 : 195;

  // ── Auth status ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/status", { credentials: "include", headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((p) => { if (mounted) setIsAuthenticated(Boolean(p?.authenticated)); })
      .catch(() => {})
      .finally(() => { if (mounted) setAuthResolved(true); });
    return () => { mounted = false; };
  }, []);

  // ── Mobile detect ──────────────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // ── RAF-driven clockwise rotation (right → left on top arc) ───────────────
  // Clockwise in CSS = increasing positive angle means nodes move:
  //   top → left  (which visually looks like right-to-left sweep across the top)
  // We negate the rotation step each frame to go counter-clockwise in math,
  // which maps to clockwise visually because CSS +Y is downward.
  useEffect(() => {
    if (!autoRotate || selectedNodeId !== null) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
        lastTimeRef.current = null;
      }
      return;
    }

    const tick = (ts: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = ts;
      const dt = (ts - lastTimeRef.current) / 1000;
      lastTimeRef.current = ts;
      // Subtract to go clockwise (right → left across top)
      setRotationAngle((prev) => (prev - rotationSpeed * dt + 360) % 360);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      lastTimeRef.current = null;
    };
  }, [autoRotate, selectedNodeId, rotationSpeed]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const calculateNodePosition = (index: number, total: number) => {
    // Spread nodes evenly; rotationAngle offsets them all
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const rad = (angle * Math.PI) / 180;
    const x = orbitRadius * Math.cos(rad);
    const y = orbitRadius * Math.sin(rad);
    // Objects at the "bottom" (sin≈1) appear closer → higher z + more opaque
    const zIndex = Math.round(100 + 50 * Math.sin(rad));
    const opacity = Math.max(0.38, Math.min(1, 0.5 + 0.5 * ((1 + Math.sin(rad)) / 2)));
    return { x, y, zIndex, opacity };
  };

  const getRelated = (id: number) =>
    timelineData.find((i) => i.id === id)?.relatedIds ?? [];

  const isRelatedToActive = (id: number) =>
    activeNodeId !== null && getRelated(activeNodeId).includes(id);

  const centerOnNode = (id: number) => {
    const idx = timelineData.findIndex((i) => i.id === id);
    const total = timelineData.length;
    // We want node to land at angle=270 (top of circle, cos=0, sin=-1)
    const target = (idx / total) * 360;
    setRotationAngle((270 - target + 360) % 360);
  };

  const selectItem = (id: number) => {
    setSelectedNodeId(id);
    setActiveNodeId(id);
    setAutoRotate(false);
    const pulse: Record<number, boolean> = {};
    getRelated(id).forEach((rid) => { pulse[rid] = true; });
    setPulseEffect(pulse);
    centerOnNode(id);
  };

  const closeModal = () => {
    setSelectedNodeId(null);
    setActiveNodeId(null);
    setPulseEffect({});
    setAutoRotate(true);
  };

  const goToItem = (item: TimelineItem) => {
    if (!item.route) return;
    if (item.requiresAuth && !isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(item.route)}`);
      return;
    }
    navigate(item.route);
  };

  const handleContainerClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current) closeModal();
  };

  const selectedItem = useMemo(
    () => timelineData.find((i) => i.id === selectedNodeId) ?? null,
    [selectedNodeId, timelineData]
  );

  const orbitDiameter = orbitRadius * 2;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${heightClassName} flex flex-col items-center justify-center overflow-hidden bg-black`}
      onClick={handleContainerClick}
    >
      {/* ── Orbital stage ─────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center"
        style={{ width: orbitDiameter + 120, height: orbitDiameter + 120 }}
      >
        {/* Orbit ring */}
        <div
          className="absolute rounded-full border border-white/10"
          style={{ width: orbitDiameter, height: orbitDiameter }}
        />

        {/* Second subtle ring */}
        <div
          className="absolute rounded-full border border-white/[0.05]"
          style={{ width: orbitDiameter + 40, height: orbitDiameter + 40 }}
        />

        {/* Centre orb */}
        <div className="absolute z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-blue-500 to-teal-400">
          {/* Ping rings */}
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-20" />
          <span
            className="absolute inline-flex h-[140%] w-[140%] animate-ping rounded-full bg-blue-400 opacity-10"
            style={{ animationDelay: "0.6s" }}
          />
          {/* Inner white dot */}
          <span className="relative h-5 w-5 rounded-full bg-white/90" />
        </div>

        {/* ── Nodes ─────────────────────────────────────────────────────── */}
        {timelineData.map((item, idx) => {
          const pos = calculateNodePosition(idx, timelineData.length);
          const isSelected = selectedNodeId === item.id;
          const isRelated = isRelatedToActive(item.id);
          const isPulsing = pulseEffect[item.id];
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              ref={(el) => (nodeRefs.current[item.id] = el)}
              className="absolute will-change-transform"
              style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                zIndex: isSelected ? 200 : pos.zIndex,
                opacity: isSelected ? 1 : pos.opacity,
                transition: "opacity 300ms ease",
              }}
              onClick={(e) => { e.stopPropagation(); selectItem(item.id); }}
            >
              {/* Counter-rotate inner so label & icon stay upright */}
              <div
                className="relative flex cursor-pointer flex-col items-center"
                style={{ transform: `rotate(${-rotationAngle}deg)`, transition: "transform 60ms linear" }}
              >
                {/* Glow ring when pulsing/selected */}
                {(isPulsing || isSelected) && (
                  <span
                    className={`absolute inset-0 -m-2 rounded-full ${isPulsing ? "animate-pulse" : ""}`}
                    style={{
                      background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)",
                    }}
                  />
                )}

                {/* Circle node */}
                <div
                  className={[
                    "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isSelected
                      ? "scale-125 border-white bg-white text-black shadow-lg shadow-white/25"
                      : isRelated
                      ? "border-white bg-white/20 text-white animate-pulse"
                      : "border-white/35 bg-black text-white/80 hover:border-white/70 hover:bg-white/10",
                  ].join(" ")}
                >
                  <Icon size={15} />
                </div>

                {/* Label below node */}
                <span
                  className={[
                    "absolute top-11 whitespace-nowrap text-[11px] font-semibold tracking-wide transition-all duration-300",
                    isSelected ? "text-white" : "text-white/55",
                  ].join(" ")}
                >
                  {item.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <p className="absolute bottom-4 text-[11px] text-white/25 tracking-widest uppercase">
        Click a node to explore
      </p>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {selectedItem && (
        <FeatureModal
          item={selectedItem}
          onClose={closeModal}
          onNavigate={goToItem}
          isAuthenticated={isAuthenticated}
          authResolved={authResolved}
          onSelectRelated={(rid) => { closeModal(); setTimeout(() => selectItem(rid), 50); }}
          timelineData={timelineData}
        />
      )}
    </div>
  );
}
