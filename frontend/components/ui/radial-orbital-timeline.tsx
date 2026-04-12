"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ElementType,
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

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

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

interface Props {
  timelineData: TimelineItem[];
  /** Degrees per second – positive = clockwise (right→left across top) */
  rotationSpeed?: number;
  heightClassName?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════ */

export default function RadialOrbitalTimeline({
  timelineData,
  rotationSpeed = 15,
  heightClassName = "h-[34rem] md:h-[46rem]",
}: Props) {
  const navigate = useNavigate();

  /* ── state ─────────────────────────────────────────────────────────── */
  const angleRef = useRef(0);                        // current angle (degrees)
  const [, forceRender] = useState(0);               // trigger re-render
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [pulseIds, setPulseIds] = useState<Set<number>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const rafRef = useRef<number | null>(null);
  const prevTsRef = useRef<number | null>(null);

  const radius = isMobile ? 125 : 200;
  const diameter = radius * 2;

  /* ── auth ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    let m = true;
    fetch("/api/auth/status", { credentials: "include", headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((p) => { if (m) setIsAuthenticated(Boolean(p?.authenticated)); })
      .catch(() => {})
      .finally(() => { if (m) setAuthResolved(true); });
    return () => { m = false; };
  }, []);

  /* ── mobile detect ──────────────────────────────────────────────────── */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const up = () => setIsMobile(mq.matches);
    up();
    mq.addEventListener("change", up);
    return () => mq.removeEventListener("change", up);
  }, []);

  /* ── RAF loop – 60 fps, no React state in hot path ─────────────────── */
  useEffect(() => {
    if (!autoRotate || selectedId !== null) {
      prevTsRef.current = null;
      return;
    }

    const tick = (ts: number) => {
      if (prevTsRef.current !== null) {
        const dt = (ts - prevTsRef.current) / 1000;
        // negative = clockwise visual (right→left on top arc)
        angleRef.current = (angleRef.current - rotationSpeed * dt) % 360;
        forceRender((n) => n + 1);
      }
      prevTsRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      prevTsRef.current = null;
    };
  }, [autoRotate, selectedId, rotationSpeed]);

  /* ── position calculator ────────────────────────────────────────────── */
  const getPos = useCallback(
    (index: number, total: number) => {
      const deg = ((index / total) * 360 + angleRef.current + 36000) % 360;
      const rad = (deg * Math.PI) / 180;
      return {
        x: radius * Math.cos(rad),
        y: radius * Math.sin(rad),
        // nodes near bottom (sin > 0) are "closer" → higher z & brighter
        z: Math.round(100 + 50 * Math.sin(rad)),
        opacity: 0.4 + 0.6 * ((1 + Math.sin(rad)) / 2),
      };
    },
    [radius]
  );

  /* ── helpers ────────────────────────────────────────────────────────── */
  const getRelated = (id: number) =>
    timelineData.find((i) => i.id === id)?.relatedIds ?? [];

  const centerOn = useCallback(
    (id: number) => {
      const idx = timelineData.findIndex((i) => i.id === id);
      const target = (idx / timelineData.length) * 360;
      angleRef.current = (270 - target + 36000) % 360;
      forceRender((n) => n + 1);
    },
    [timelineData]
  );

  const select = useCallback(
    (id: number) => {
      setSelectedId(id);
      setActiveId(id);
      setAutoRotate(false);
      setPulseIds(new Set(getRelated(id)));
      centerOn(id);
      // small delay so the DOM mounts then animates in
      requestAnimationFrame(() => setModalVisible(true));
    },
    [centerOn]
  );

  const close = useCallback(() => {
    setModalVisible(false);
    // wait for fade-out before unmounting
    setTimeout(() => {
      setSelectedId(null);
      setActiveId(null);
      setPulseIds(new Set());
      setAutoRotate(true);
    }, 200);
  }, []);

  const goTo = useCallback(
    (item: TimelineItem) => {
      if (!item.route) return;
      if (item.requiresAuth && !isAuthenticated) {
        navigate(`/login?next=${encodeURIComponent(item.route)}`);
        return;
      }
      navigate(item.route);
    },
    [isAuthenticated, navigate]
  );

  const selectedItem = useMemo(
    () => timelineData.find((i) => i.id === selectedId) ?? null,
    [selectedId, timelineData]
  );

  /* ═══════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════ */

  return (
    <div
      className={`relative w-full ${heightClassName} flex items-center justify-center overflow-hidden bg-black`}
    >
      {/* ── Orbit stage ─────────────────────────────────────────────── */}
      <div
        className="relative"
        style={{ width: diameter + 100, height: diameter + 100 }}
      >
        {/* Outer faint ring */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]"
          style={{ width: diameter + 50, height: diameter + 50 }}
        />
        {/* Main orbit ring */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.12]"
          style={{ width: diameter, height: diameter }}
        />

        {/* Centre orb */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-blue-500 to-teal-400 shadow-lg shadow-violet-500/20">
            <span className="absolute h-full w-full animate-ping rounded-full bg-violet-400 opacity-15" />
            <span
              className="absolute h-[150%] w-[150%] animate-ping rounded-full bg-blue-400 opacity-10"
              style={{ animationDelay: "0.5s", animationDuration: "1.8s" }}
            />
            <span className="h-5 w-5 rounded-full bg-white/90" />
          </div>
        </div>

        {/* ── Nodes ─────────────────────────────────────────────────── */}
        {timelineData.map((item, idx) => {
          const pos = getPos(idx, timelineData.length);
          const isSelected = selectedId === item.id;
          const isRelated = activeId !== null && getRelated(activeId).includes(item.id);
          const isPulsing = pulseIds.has(item.id);
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className="absolute left-1/2 top-1/2 will-change-transform"
              style={{
                transform: `translate3d(${pos.x - 20}px, ${pos.y - 20}px, 0)`,
                zIndex: isSelected ? 250 : pos.z,
                opacity: isSelected ? 1 : pos.opacity,
              }}
              onClick={(e) => {
                e.stopPropagation();
                select(item.id);
              }}
            >
              <div className="flex cursor-pointer flex-col items-center">
                {/* Glow */}
                {(isPulsing || isSelected) && (
                  <span
                    className="absolute -inset-3 rounded-full animate-pulse"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)",
                    }}
                  />
                )}

                {/* Circle */}
                <div
                  className={[
                    "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform duration-200",
                    isSelected
                      ? "scale-[1.2] border-white bg-white text-black shadow-lg shadow-white/20"
                      : isRelated
                        ? "border-white bg-white/20 text-white"
                        : "border-white/30 bg-black text-white/80 hover:border-white/60 hover:bg-white/[0.08]",
                  ].join(" ")}
                >
                  <Icon size={15} strokeWidth={1.8} />
                </div>

                {/* Label – always upright, no rotation tricks */}
                <span
                  className={[
                    "mt-1.5 whitespace-nowrap text-center text-[10px] font-semibold tracking-wider",
                    isSelected ? "text-white" : "text-white/50",
                  ].join(" ")}
                >
                  {item.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint text */}
      <p className="absolute bottom-5 text-[10px] uppercase tracking-[0.25em] text-white/20">
        Click a node to explore
      </p>

      {/* ── Modal overlay ─────────────────────────────────────────────── */}
      {selectedItem && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center p-4"
          onClick={close}
          style={{
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            opacity: modalVisible ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        >
          <Card
            className="relative w-full max-w-md border-white/15 bg-[#0b0b0c] text-white shadow-2xl shadow-black/60"
            style={{
              transform: modalVisible
                ? "translateY(0) scale(1)"
                : "translateY(16px) scale(0.97)",
              opacity: modalVisible ? 1 : 0,
              transition:
                "transform 250ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close btn */}
            <button
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
              onClick={close}
            >
              <X size={13} />
            </button>

            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
                  {(() => { const I = selectedItem.icon; return <I size={16} />; })()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`px-2 text-[10px] ${
                        selectedItem.status === "completed"
                          ? "bg-white text-black border-transparent"
                          : selectedItem.status === "in-progress"
                            ? "bg-white/15 text-white border-transparent"
                            : "bg-white/[0.06] text-white/50 border-transparent"
                      }`}
                    >
                      {selectedItem.status === "completed"
                        ? "Complete"
                        : selectedItem.status === "in-progress"
                          ? "In Progress"
                          : "Pending"}
                    </Badge>
                    <span className="text-[11px] text-white/30">
                      {selectedItem.date}
                    </span>
                  </div>
                  <CardTitle className="mt-1 text-base leading-snug tracking-tight">
                    {selectedItem.title}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>

            <CardContent className="max-h-[65vh] space-y-4 overflow-y-auto pb-5">
              {/* Description */}
              <p className="text-sm leading-relaxed text-white/70">
                {selectedItem.content}
              </p>

              {/* Progress */}
              <div className="rounded-lg border border-white/8 bg-black/40 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-white/45">
                    <Zap size={10} />
                    {selectedItem.progressLabel || "Progress"}
                  </span>
                  <span className="font-mono text-white/55">
                    {selectedItem.energy}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                    style={{
                      width: `${selectedItem.energy}%`,
                      transition: "width 600ms ease",
                    }}
                  />
                </div>
              </div>

              {/* Includes */}
              {selectedItem.includes && selectedItem.includes.length > 0 && (
                <ul className="space-y-1.5">
                  {selectedItem.includes.map((pt) => (
                    <li
                      key={pt}
                      className="flex items-start gap-2 text-[13px] text-white/60"
                    >
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
                      {pt}
                    </li>
                  ))}
                </ul>
              )}

              {/* How it works */}
              {selectedItem.howItWorks && (
                <div className="border-t border-white/8 pt-3">
                  <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                    How It Works
                  </h4>
                  <p className="text-[13px] leading-relaxed text-white/55">
                    {selectedItem.howItWorks}
                  </p>
                </div>
              )}

              {/* Steps */}
              {selectedItem.step && selectedItem.totalSteps && (
                <div className="border-t border-white/8 pt-3">
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/35">
                    <span>Workflow</span>
                    <span>
                      {selectedItem.step} / {selectedItem.totalSteps}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: selectedItem.totalSteps }).map(
                      (_, i) => (
                        <span
                          key={`step-${i}`}
                          className={`h-1 flex-1 rounded-full ${
                            i < selectedItem.step!
                              ? "bg-white"
                              : "bg-white/10"
                          }`}
                        />
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Connected nodes */}
              {selectedItem.relatedIds.length > 0 && (
                <div className="border-t border-white/8 pt-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/30">
                    <LinkIcon size={10} /> Connected
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.relatedIds.map((rid) => {
                      const rel = timelineData.find((i) => i.id === rid);
                      if (!rel) return null;
                      return (
                        <button
                          key={rid}
                          className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                          onClick={() => {
                            select(rid);
                          }}
                        >
                          {rel.title}
                          <ArrowRight size={9} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Access + CTA */}
              <div className="border-t border-white/8 pt-3">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/45">
                  {selectedItem.requiresAuth ? (
                    <>
                      <Lock size={10} /> Login required
                    </>
                  ) : (
                    <>
                      <Unlock size={10} /> Public
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-8 flex-1 bg-white text-xs text-black hover:bg-zinc-100"
                    onClick={() => goTo(selectedItem)}
                    disabled={selectedItem.requiresAuth && !authResolved}
                  >
                    {selectedItem.requiresAuth && !isAuthenticated
                      ? "Go To Login"
                      : selectedItem.routeLabel || "Open Feature"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-white/15 bg-transparent text-xs text-white hover:bg-white/10"
                    onClick={close}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
