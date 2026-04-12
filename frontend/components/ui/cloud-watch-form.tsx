"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormMode = "login" | "register" | "forgot";

interface CloudWatchFormProps {
  mode: FormMode;
  action: string;
}

const defaultsByMode = {
  login: {
    title: "Welcome Back",
    subtitle: "Sign in and continue execution.",
    submit: "Sign In",
  },
  register: {
    title: "Create Account",
    subtitle: "Set up your AI meeting workspace.",
    submit: "Create Account",
  },
  forgot: {
    title: "Reset Password",
    subtitle: "We will send a reset code to your email.",
    submit: "Send Reset Code",
  },
} as const;

export default function CloudWatchForm({ mode, action }: CloudWatchFormProps) {
  const navigate = useNavigate();
  const [isTyping, setIsTyping] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = defaultsByMode[mode];

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useEffect(() => {
    const offsetX = (cursor.x / window.innerWidth - 0.5) * 5.5;
    const offsetY = (cursor.y / window.innerHeight - 0.5) * 2.5;
    setEyePos({ x: offsetX, y: offsetY });
  }, [cursor]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mode !== "register") {
      return;
    }

    const normalized = username.trim();
    if (normalized.length < 3) {
      setUsernameAvailable(null);
      setUsernameMessage(normalized.length === 0 ? "" : "Enter at least 3 characters.");
      setIsChecking(false);
      return;
    }

    const timeout = setTimeout(async () => {
      const controller = new AbortController();
      const requestTimeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        setIsChecking(true);
        const response = await fetch("/check_username", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ username: normalized }),
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !contentType.includes("application/json")) {
          setUsernameAvailable(null);
          setUsernameMessage("Could not check username right now.");
          return;
        }

        const payload = await response.json();
        setUsernameAvailable(Boolean(payload?.available));
        setUsernameMessage(payload?.message || "");
      } catch {
        setUsernameAvailable(null);
        setUsernameMessage("Could not check username right now. Please continue registration.");
      } finally {
        window.clearTimeout(requestTimeout);
        setIsChecking(false);
      }
    }, 420);

    return () => clearTimeout(timeout);
  }, [mode, username]);

  const statusTone = useMemo(() => {
    if (usernameAvailable === true) {
      return "text-emerald-300";
    }
    if (usernameAvailable === false) {
      return "text-rose-300";
    }
    return "text-white/55";
  }, [usernameAvailable]);

  const disableSubmit =
    mode === "register" && (isChecking || usernameAvailable === false || username.trim().length < 3);

  const pupilX = Math.max(-2.8, Math.min(2.8, eyePos.x));
  const pupilY = Math.max(-1.2, Math.min(1.2, eyePos.y));
  const eyeAnchors = [
    { left: 84, top: 72 },
    { left: 152, top: 72 },
  ];

  const endpointByMode: Record<FormMode, string> = {
    login: "/api/auth/login",
    register: "/api/auth/register",
    forgot: "/api/auth/forgot-password",
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, unknown> = {};

    formData.forEach((value, key) => {
      payload[key] = value;
    });

    if (mode === "login") {
      payload.remember = formData.get("remember") === "on";
    }
    if (mode === "register") {
      payload.terms = formData.get("terms") === "on";
    }

    try {
      setIsSubmitting(true);
      const controller = new AbortController();
      const requestTimeout = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch(endpointByMode[mode], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
        signal: controller.signal,
      });
      window.clearTimeout(requestTimeout);

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { success: false, message: "Server returned an unexpected response." };

      if (!response.ok || !data?.success) {
        setFormError(data?.message || "Authentication failed. Please try again.");
        if (data?.redirect) {
          navigate(data.redirect);
        }
        return;
      }

      if (data?.redirect) {
        window.location.href = data.redirect;
        return;
      }

      setFormError(data?.message || "Done.");
    } catch {
      setFormError("Server timeout or network issue. Please try again in a few seconds.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-[calc(100vh-72px)] items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(255,255,255,0.15),transparent_55%),radial-gradient(900px_450px_at_100%_100%,rgba(114,180,255,0.2),transparent_60%),linear-gradient(180deg,#0a0a0a_0%,#000_100%)]" />

      <div className="w-full max-w-5xl rounded-[2rem] border border-white/15 bg-white/[0.03] p-4 shadow-[0_30px_120px_-45px_rgba(255,255,255,0.35)] backdrop-blur-xl md:p-8">
        <div className="grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">AI Meeting Agent</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{config.title}</h2>
            <p className="mt-2 text-sm text-white/70">{config.subtitle}</p>

            <div className="mt-8 flex items-center justify-center">
              <div className="relative h-[180px] w-[300px]">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" />
                <img
                  src="https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/cloud.jpg"
                  alt="Cloud avatar"
                  className="relative z-10 h-full w-full rounded-2xl object-cover mix-blend-darken opacity-100 brightness-125 contrast-125 saturate-110"
                />

                <div className="absolute inset-0 z-20 rounded-2xl bg-gradient-to-t from-black/15 via-transparent to-black/5" />

                {["left", "right"].map((side, idx) => (
                  <div
                    key={side}
                    className="absolute flex items-end justify-center overflow-hidden"
                    style={{
                      top: eyeAnchors[idx].top,
                      left: eyeAnchors[idx].left,
                      width: 26,
                      height: isTyping ? 4 : blink ? 6 : 28,
                      borderRadius: isTyping || blink ? "2px" : "50% / 60%",
                      backgroundColor: isTyping ? "black" : "white",
                      transition: "all 0.16s ease",
                      boxShadow: isTyping ? "none" : "0 0 0 1px rgba(0,0,0,0.14) inset",
                    }}
                  >
                    {!isTyping && (
                      <div
                        className="bg-black"
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          marginBottom: 4,
                          transform: `translate(${pupilX}px, ${pupilY}px)`,
                          transition: "all 0.1s ease",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form action={action} method="post" onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-white/12 bg-black/35 p-6">
            {mode === "register" && (
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
                <p className={`min-h-5 text-xs ${statusTone}`}>
                  {isChecking ? (
                    <span className="inline-flex items-center gap-1">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Checking availability...
                    </span>
                  ) : (
                    usernameMessage
                  )}
                </p>
              </div>
            )}

            {(mode === "register" || mode === "login") && (
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@company.com" required />
              </div>
            )}

            {mode === "forgot" && (
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@company.com" required />
              </div>
            )}

            {(mode === "register" || mode === "login") && (
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Password"
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  required
                />
              </div>
            )}

            {mode === "register" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="confirm_password">Confirm Password</Label>
                  <Input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    placeholder="Re-enter password"
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    required
                  />
                </div>
                <label className="flex items-start gap-2 text-xs text-white/70">
                  <input name="terms" type="checkbox" className="mt-0.5" required />
                  I agree to the Terms of Service and Privacy Policy.
                </label>
              </>
            )}

            {mode === "login" && (
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input name="remember" type="checkbox" /> Remember me
              </label>
            )}

            <Button type="submit" className="mt-2 h-11 w-full rounded-xl" disabled={disableSubmit || isSubmitting}>
              {config.submit}
            </Button>

            {formError && <p className="text-xs text-rose-300">{formError}</p>}

            <div className="mt-1 flex items-center justify-between text-xs text-white/70">
              {mode !== "login" ? (
                <Link to="/login" className="hover:text-white">
                  Already have an account?
                </Link>
              ) : (
                <Link to="/register" className="hover:text-white">
                  Create account
                </Link>
              )}
              {mode !== "forgot" ? (
                <Link to="/forget-password" className="hover:text-white">
                  Forgot password?
                </Link>
              ) : (
                <Link to="/login" className="hover:text-white">
                  Back to login
                </Link>
              )}
            </div>

            <p className="mt-2 text-center text-xs text-white/45">
              Start both services for full integration: backend (`python run.py`) and frontend (`cd frontend && npm run dev`).
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
