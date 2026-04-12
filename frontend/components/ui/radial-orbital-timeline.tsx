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
  RotateCcw,
  RotateCw,
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
  rotationStep?: number;
  rotationIntervalMs?: number;
  heightClassName?: string;
}

export default function RadialOrbitalTimeline({
  timelineData,
  rotationStep = 0.3,
  rotationIntervalMs = 50,
  heightClassName = "h-[34rem] md:h-[46rem]",
}: RadialOrbitalTimelineProps) {
  const navigate = useNavigate();
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const orbitRadius = isMobile ? 132 : 200;
  const orbitDiameter = orbitRadius * 2;
  const rotationSpeedDegPerSecond = useMemo(
    () => Math.max(2, (rotationStep / Math.max(rotationIntervalMs, 16)) * 1000),
    [rotationIntervalMs, rotationStep]
  );

  const selectedItem = useMemo(
    () => timelineData.find((item) => item.id === selectedNodeId) || null,
    [selectedNodeId, timelineData]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);

    return () => mediaQuery.removeEventListener("change", updateIsMobile);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const readAuthStatus = async () => {
      try {
        const response = await fetch("/api/auth/status", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const payload = await response.json();
        if (isMounted) {
          setIsAuthenticated(Boolean(payload?.authenticated));
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setAuthResolved(true);
        }
      }
    };

    readAuthStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!autoRotate || selectedNodeId !== null) {
      return;
    }

    const tick = (timestamp: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
      }
      const deltaSeconds = (timestamp - (lastFrameTimeRef.current || timestamp)) / 1000;
      lastFrameTimeRef.current = timestamp;
      setRotationAngle((prev) => (prev + rotationSpeedDegPerSecond * deltaSeconds) % 360);
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [autoRotate, selectedNodeId, rotationSpeedDegPerSecond]);

  const handleContainerClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setSelectedNodeId(null);
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const selectItem = (id: number) => {
    setSelectedNodeId(id);
    setActiveNodeId(id);
    setAutoRotate(false);

    const relatedItems = getRelatedItems(id);
    const newPulseEffect: Record<number, boolean> = {};
    relatedItems.forEach((relId) => {
      newPulseEffect[relId] = true;
    });
    setPulseEffect(newPulseEffect);
    centerViewOnNode(id);
  };

  const centerViewOnNode = (nodeId: number) => {
    if (!nodeRefs.current[nodeId]) return;

    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;

    setRotationAngle(270 - targetAngle);
  };

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radian = (angle * Math.PI) / 180;

    const x = orbitRadius * Math.cos(radian);
    const y = orbitRadius * Math.sin(radian);

    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.45, Math.min(1, 0.55 + 0.45 * ((1 + Math.sin(radian)) / 2)));

    return { x, y, zIndex, opacity };
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    const relatedItems = getRelatedItems(activeNodeId);
    return relatedItems.includes(itemId);
  };

  const rotateManual = (delta: number) => {
    setAutoRotate(false);
    setRotationAngle((prev) => (prev + delta + 360) % 360);
  };

  const closeModal = () => {
    setSelectedNodeId(null);
    setActiveNodeId(null);
    setPulseEffect({});
    setAutoRotate(true);
  };

  const goToItem = (item: TimelineItem) => {
    if (!item.route) {
      return;
    }
    if (item.requiresAuth && !isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(item.route)}`);
      return;
    }
    navigate(item.route);
  };

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed":
        return "text-white bg-black border-white";
      case "in-progress":
        return "text-black bg-white border-black";
      case "pending":
        return "text-white bg-black/40 border-white/50";
      default:
        return "text-white bg-black/40 border-white/50";
    }
  };

  return (
    <div
      className={`w-full ${heightClassName} flex flex-col items-center justify-center bg-black overflow-hidden`}
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <div className="mb-4 flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-4 text-[11px] text-white/70 md:text-xs">
        <div className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5">
          Orbit direction: clockwise. Click a node to pause and inspect details.
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={() => rotateManual(-14)}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Left
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={() => rotateManual(14)}
          >
            <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Right
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={() => setAutoRotate((prev) => !prev)}
          >
            {autoRotate ? "Pause Orbit" : "Resume Orbit"}
          </Button>
        </div>
      </div>
      <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
        <div
          className="absolute w-full h-full flex items-center justify-center"
          ref={orbitRef}
          style={{
            perspective: "1000px",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-500 animate-pulse flex items-center justify-center z-10">
            <div className="absolute w-20 h-20 rounded-full border border-white/20 animate-ping opacity-70"></div>
            <div
              className="absolute w-24 h-24 rounded-full border border-white/10 animate-ping opacity-50"
              style={{ animationDelay: "0.5s" }}
            ></div>
            <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md"></div>
          </div>

          <div
            className="absolute rounded-full border border-white/10"
            style={{ width: `${orbitDiameter}px`, height: `${orbitDiameter}px` }}
          ></div>

          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = selectedNodeId === item.id;
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            const nodeStyle = {
              transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
              zIndex: isExpanded ? 200 : position.zIndex,
              opacity: isExpanded ? 1 : position.opacity,
            };

            return (
              <div
                key={item.id}
                ref={(el) => (nodeRefs.current[item.id] = el)}
                className="absolute cursor-pointer will-change-transform"
                style={nodeStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  selectItem(item.id);
                }}
              >
                  <div
                    className="relative flex flex-col items-center"
                    style={{ transform: `rotate(${-rotationAngle}deg)` }}
                  >
                <div
                  className={`absolute rounded-full -inset-1 ${
                    isPulsing ? "animate-pulse duration-1000" : ""
                  }`}
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)",
                    width: `${item.energy * 0.5 + 40}px`,
                    height: `${item.energy * 0.5 + 40}px`,
                    left: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                    top: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                  }}
                ></div>

                <div
                  className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${
                    selectedNodeId === item.id
                      ? "bg-white text-black"
                      : isRelated
                        ? "bg-white/50 text-black"
                        : "bg-black text-white"
                  }
                  border-2
                  ${
                    selectedNodeId === item.id
                      ? "border-white shadow-lg shadow-white/30"
                      : isRelated
                        ? "border-white animate-pulse"
                        : "border-white/40"
                  }
                  transition-all duration-300 transform
                  ${selectedNodeId === item.id ? "scale-125" : ""}
                `}
                >
                  <Icon size={16} />
                </div>

                <div
                  className={`
                  absolute top-12 whitespace-nowrap
                  text-xs font-semibold tracking-wider
                  transition-all duration-300
                  ${selectedNodeId === item.id ? "text-white scale-110" : "text-white/70"}
                `}
                >
                  {item.title}
                </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {selectedItem && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm md:p-6" onClick={closeModal}>
            <Card
              className="w-full max-w-xl border-white/20 bg-[linear-gradient(170deg,rgba(20,20,20,0.98),rgba(8,8,8,0.98))] text-white shadow-2xl shadow-black/60"
              onClick={(event) => event.stopPropagation()}
            >
              <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Badge className={`px-2 text-xs ${getStatusStyles(selectedItem.status)}`}>
                        {selectedItem.status === "completed"
                          ? "COMPLETE"
                          : selectedItem.status === "in-progress"
                            ? "IN PROGRESS"
                            : "PENDING"}
                      </Badge>
                      <span className="text-xs text-white/50">{selectedItem.date}</span>
                    </div>
                    <CardTitle className="text-xl tracking-tight">{selectedItem.title}</CardTitle>
                    <p className="mt-1 text-sm text-white/65">{selectedItem.category}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-white/20 bg-transparent text-white hover:bg-white/10"
                    onClick={closeModal}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="max-h-[78vh] overflow-y-auto px-5 pb-5 pt-4 sm:max-h-[72vh]">
                <p className="text-sm leading-6 text-white/80">{selectedItem.content}</p>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center">
                      <Zap size={12} className="mr-1.5" />
                      {selectedItem.progressLabel || "Execution Progress"}
                    </span>
                    <span className="font-mono">{selectedItem.energy}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-all duration-500"
                      style={{ width: `${selectedItem.energy}%` }}
                    />
                  </div>
                </div>

                {selectedItem.includes && selectedItem.includes.length > 0 && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Included</h4>
                    <ul className="mt-2 space-y-2 text-sm text-white/80">
                      {selectedItem.includes.map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedItem.howItWorks && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">How It Works</h4>
                    <p className="mt-2 text-sm leading-6 text-white/80">{selectedItem.howItWorks}</p>
                  </div>
                )}

                {selectedItem.step && selectedItem.totalSteps && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/60">
                      <span>Workflow Steps</span>
                      <span>
                        {selectedItem.step} of {selectedItem.totalSteps}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {Array.from({ length: selectedItem.totalSteps }).map((_, index) => (
                        <span
                          key={`${selectedItem.id}-step-${index + 1}`}
                          className={`h-1.5 flex-1 rounded-full ${
                            index < selectedItem.step! ? "bg-white" : "bg-white/15"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.relatedIds.length > 0 && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="mb-2 flex items-center">
                      <LinkIcon size={12} className="mr-2 text-white/60" />
                      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Connected Nodes</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.relatedIds.map((relatedId) => {
                        const relatedItem = timelineData.find((item) => item.id === relatedId);
                        if (!relatedItem) {
                          return null;
                        }
                        return (
                          <Button
                            key={relatedId}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 border-white/20 bg-transparent px-3 text-xs text-white hover:bg-white/10"
                            onClick={() => selectItem(relatedId)}
                          >
                            {relatedItem.title}
                            <ArrowRight className="ml-1.5 h-3 w-3" />
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-5 border-t border-white/10 pt-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/60">Access</div>
                  {selectedItem.requiresAuth ? (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/80">
                      <Lock className="h-3.5 w-3.5" /> Login required for this feature
                    </div>
                  ) : (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/80">
                      <Unlock className="h-3.5 w-3.5" /> Public feature
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="bg-white text-black hover:bg-zinc-200"
                      onClick={() => goToItem(selectedItem)}
                      disabled={selectedItem.requiresAuth && !authResolved}
                    >
                      {selectedItem.requiresAuth && !isAuthenticated
                        ? "Go To Login"
                        : selectedItem.routeLabel || "Open Feature"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/20 bg-transparent text-white hover:bg-white/10"
                      onClick={closeModal}
                    >
                      Continue Exploring
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
