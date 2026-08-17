"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, Check, AlertCircle } from "lucide-react";

/**
 * Setting a password from an invitation link.
 *
 * No session is created at the end. Sending them to the normal sign-in screen
 * proves the password works and puts them through the emailed code once, which
 * is the part most likely to go wrong later — better to find out now, while
 * whoever invited them is still expecting to hear.
 */

interface Invitation {
  name: string;
  email: string;
  minPasswordLength: number;
}

const INPUT =
  "w-full bg-white border-2 border-sage/20 rounded-xl px-4 py-3.5 font-sans text-sm text-forest placeholder:text-forest/30 focus:outline-none focus:border-clay/50 transition-colors";

export default function AcceptInvite({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLinkError("This link is missing its invitation code.");
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.valid) {
          setLinkError(data.error ?? "That invitation link is no longer valid.");
        } else {
          setInvitation(data);
        }
      } catch {
        if (!cancelled) setLinkError("Could not reach the server. Check your connection.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const minLength = invitation?.minPasswordLength ?? 12;

  const submit = async () => {
    setError("");
    if (password.length < minLength) {
      setError(`Password must be at least ${minLength} characters`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not set up your account.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-forest flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-cream rounded-3xl p-10 w-full max-w-sm shadow-2xl"
      >
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 bg-forest rounded-2xl flex items-center justify-center">
            {done ? (
              <Check className="w-6 h-6 text-cream" />
            ) : (
              <Lock className="w-6 h-6 text-cream" />
            )}
          </div>
        </div>

        {checking && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-forest/40" />
          </div>
        )}

        {!checking && linkError && (
          <div className="text-center">
            <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-3" />
            <p className="font-sans text-sm text-forest/70 leading-relaxed">{linkError}</p>
            <p className="font-sans text-xs text-forest/40 mt-4">
              Invitations expire after two days. Ask for a new one.
            </p>
          </div>
        )}

        {!checking && done && (
          <div className="text-center">
            <h1 className="font-serif text-xl font-semibold text-forest mb-2">
              Your account is ready
            </h1>
            <p className="font-sans text-sm text-forest/60 leading-relaxed mb-6">
              Sign in with your email and the password you just chose. A six-digit
              code will be emailed to you each time.
            </p>
            <a
              href="/admin"
              className="block w-full bg-forest text-cream font-sans text-sm font-medium py-3.5 rounded-xl hover:bg-forest-deep transition-colors"
            >
              Go to the dashboard
            </a>
          </div>
        )}

        {!checking && invitation && !done && (
          <>
            <h1 className="font-serif text-xl font-semibold text-forest text-center mb-1">
              Welcome, {invitation.name}
            </h1>
            <p className="font-sans text-sm text-forest/50 text-center mb-6">
              Choose a password for {invitation.email}
            </p>

            <input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`New password (${minLength}+ characters)`}
              className={`${INPUT} mb-3`}
            />
            <input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Repeat password"
              className={`${INPUT} mb-4`}
            />

            {error && (
              <p className="font-sans text-xs text-red-500 text-center mb-3">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={saving}
              className="w-full bg-forest text-cream font-sans text-sm font-medium py-3.5 rounded-xl hover:bg-forest-deep transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set password"}
            </button>

            <p className="font-sans text-xs text-forest/40 text-center mt-5 leading-relaxed">
              This dashboard holds client records. Use a password you do not use
              anywhere else.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
