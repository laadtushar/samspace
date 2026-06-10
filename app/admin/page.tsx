"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  LogOut,
  Users,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Check,
  Download,
} from "lucide-react";

interface Submission {
  id: string;
  timestamp: string;
  name: string;
  email: string;
  gender: string;
  age: string;
  whatsapp: string;
  education: string;
  preferredLanguage: string;
  concerns: string;
  slidingScale: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<"submissions" | "content">("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const headers = { "x-admin-password": password };

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthed(true);
      } else {
        setAuthError("Invalid password");
      }
    } catch {
      setAuthError("Connection error");
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    Promise.all([
      fetch("/api/admin/submissions", { headers }).then((r) => r.json()),
      fetch("/api/admin/content", { headers }).then((r) => r.json()),
    ])
      .then(async ([subs, cont]) => {
        setSubmissions(subs);
        setContent(cont);
        // Auto-seed: save defaults to Blob so they're editable
        await fetch("/api/admin/content", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(cont),
        }).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [authed]);

  const handleSaveContent = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/content", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    if (!submissions.length) return;
    const fields = [
      "timestamp",
      "name",
      "email",
      "gender",
      "age",
      "whatsapp",
      "education",
      "preferredLanguage",
      "concerns",
      "slidingScale",
    ];
    const csv = [
      fields.join(","),
      ...submissions.map((s) =>
        fields
          .map((f) => `"${String((s as unknown as Record<string, unknown>)[f] || "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `samvriti-intake-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Login Screen ────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-forest flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-cream rounded-3xl p-10 w-full max-w-sm shadow-2xl"
        >
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 bg-forest rounded-2xl flex items-center justify-center">
              <Lock className="w-6 h-6 text-cream" />
            </div>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-forest text-center mb-2">
            Samvriti.Space
          </h1>
          <p className="font-sans text-sm text-forest/50 text-center mb-8">
            Admin Dashboard
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Enter password"
            className="w-full bg-white border-2 border-sage/20 rounded-xl px-4 py-3.5 font-sans text-sm text-forest placeholder:text-forest/30 focus:outline-none focus:border-clay/50 transition-colors mb-4"
          />
          {authError && (
            <p className="font-sans text-xs text-red-500 text-center mb-3">{authError}</p>
          )}
          <button
            onClick={handleLogin}
            disabled={authLoading}
            className="w-full bg-forest text-cream font-sans text-sm font-medium py-3.5 rounded-xl hover:bg-forest-deep transition-colors flex items-center justify-center gap-2"
          >
            {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Login"}
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── Dashboard ────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-forest text-cream border-b border-sage/20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-serif text-lg font-semibold">Samvriti.Space Admin</span>
          <button
            onClick={() => { setAuthed(false); setPassword(""); }}
            className="font-sans text-xs text-cream/60 hover:text-cream flex items-center gap-1 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex gap-2 mb-6">
          {[
            { id: "submissions" as const, label: "Intake Submissions", icon: Users, count: submissions.length },
            { id: "content" as const, label: "Edit Content", icon: FileText },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-sans text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all ${
                tab === t.id
                  ? "bg-forest text-cream shadow-md"
                  : "bg-white text-forest/60 hover:bg-forest/5 border border-sage/20"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  tab === t.id ? "bg-cream/20" : "bg-sage/20"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-forest/40" />
          </div>
        ) : (
          <>
            {/* ─── Submissions Tab ──────────────── */}
            {tab === "submissions" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-xl font-semibold text-forest">
                    Therapy Intake Submissions
                  </h2>
                  {submissions.length > 0 && (
                    <button
                      onClick={exportCSV}
                      className="font-sans text-xs text-forest/50 hover:text-forest flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sage/20 hover:border-sage/40 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                  )}
                </div>

                {submissions.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-2xl border border-sage/15">
                    <Users className="w-10 h-10 text-sage/30 mx-auto mb-3" />
                    <p className="font-sans text-sm text-forest/40">No submissions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((s) => (
                      <motion.div
                        key={s.id}
                        layout
                        className="bg-white rounded-xl border border-sage/15 overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                          className="w-full px-5 py-4 flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0">
                              <span className="font-serif text-sm font-semibold text-forest">
                                {s.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-sans text-sm font-medium text-forest">{s.name}</p>
                              <p className="font-sans text-xs text-forest/40">
                                {new Date(s.timestamp).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                &nbsp;·&nbsp;{s.slidingScale}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-sans text-xs text-forest/40 hidden sm:block">
                              {s.email}
                            </span>
                            {expandedId === s.id ? (
                              <ChevronUp className="w-4 h-4 text-forest/30" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-forest/30" />
                            )}
                          </div>
                        </button>

                        <AnimatePresence>
                          {expandedId === s.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-5 pt-2 border-t border-sage/10">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                                  {[
                                    ["Email", s.email],
                                    ["Gender", s.gender],
                                    ["Age", s.age],
                                    ["WhatsApp", s.whatsapp],
                                    ["Education", s.education],
                                    ["Language", s.preferredLanguage],
                                    ["Scale", s.slidingScale],
                                  ].map(([label, val]) => (
                                    <div key={label}>
                                      <p className="font-sans text-[10px] text-forest/40 uppercase tracking-wider">
                                        {label}
                                      </p>
                                      <p className="font-sans text-sm text-forest">{val || "—"}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="bg-cream rounded-lg p-4">
                                  <p className="font-sans text-[10px] text-forest/40 uppercase tracking-wider mb-1">
                                    Concerns
                                  </p>
                                  <p className="font-sans text-sm text-forest/80 leading-relaxed whitespace-pre-wrap">
                                    {s.concerns}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Content Tab ──────────────────── */}
            {tab === "content" && content && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-xl font-semibold text-forest">
                    Edit Site Content
                  </h2>
                  <button
                    onClick={handleSaveContent}
                    disabled={saving}
                    className="font-sans text-sm font-medium bg-forest text-cream px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-forest-deep transition-colors disabled:opacity-60"
                  >
                    {saved ? (
                      <><Check className="w-4 h-4" /> Saved!</>
                    ) : saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><Save className="w-4 h-4" /> Save Changes</>
                    )}
                  </button>
                </div>

                <p className="font-sans text-xs text-forest/40 mb-6">
                  Changes go live within ~60 seconds after saving.
                </p>

                <div className="space-y-6">
                  <ContentSection title="Hero Section">
                    <ContentField
                      label="Headline"
                      value={(content as any).hero?.headline}
                      onChange={(v) =>
                        setContent({ ...content, hero: { ...(content as any).hero, headline: v } })
                      }
                    />
                    <ContentField
                      label="Subtext"
                      value={(content as any).hero?.subtext}
                      onChange={(v) =>
                        setContent({ ...content, hero: { ...(content as any).hero, subtext: v } })
                      }
                      textarea
                    />
                    <ContentField
                      label="Quote Text"
                      value={(content as any).hero?.quoteText}
                      onChange={(v) =>
                        setContent({ ...content, hero: { ...(content as any).hero, quoteText: v } })
                      }
                      textarea
                    />
                  </ContentSection>

                  <ContentSection title="About Section">
                    <ContentField
                      label="Heading"
                      value={(content as any).about?.heading}
                      onChange={(v) =>
                        setContent({ ...content, about: { ...(content as any).about, heading: v } })
                      }
                    />
                    <ContentField
                      label="Paragraph"
                      value={(content as any).about?.paragraph}
                      onChange={(v) =>
                        setContent({ ...content, about: { ...(content as any).about, paragraph: v } })
                      }
                      textarea
                    />
                  </ContentSection>

                  <ContentSection title="Issues List">
                    <ContentField
                      label="Issues (one per line)"
                      value={(content as any).issues?.items?.join("\n") || ""}
                      onChange={(v) =>
                        setContent({
                          ...content,
                          issues: {
                            ...(content as any).issues,
                            items: v.split("\n").filter((x: string) => x.trim()),
                          },
                        })
                      }
                      textarea
                    />
                  </ContentSection>

                  <ContentSection title="Contact Info">
                    <ContentField
                      label="Email"
                      value={(content as any).contact?.email}
                      onChange={(v) =>
                        setContent({ ...content, contact: { ...(content as any).contact, email: v } })
                      }
                    />
                    <ContentField
                      label="Phone"
                      value={(content as any).contact?.phone}
                      onChange={(v) =>
                        setContent({ ...content, contact: { ...(content as any).contact, phone: v } })
                      }
                    />
                  </ContentSection>

                  <ContentSection title="Services">
                    {((content as any).services?.items || []).map((item: any, idx: number) => (
                      <div key={idx} className="bg-cream rounded-lg p-4 space-y-3">
                        <p className="font-sans text-xs font-semibold text-forest/60">Service {idx + 1}</p>
                        <ContentField
                          label="Title"
                          value={item.title || ""}
                          onChange={(v) => {
                            const items = [...(content as any).services.items];
                            items[idx] = { ...items[idx], title: v };
                            setContent({ ...content, services: { ...(content as any).services, items } });
                          }}
                        />
                        <ContentField
                          label="Price (e.g. ₹500–₹1000 or leave empty)"
                          value={item.price || ""}
                          onChange={(v) => {
                            const items = [...(content as any).services.items];
                            items[idx] = { ...items[idx], price: v || null };
                            setContent({ ...content, services: { ...(content as any).services, items } });
                          }}
                        />
                        <ContentField
                          label="Tags (comma-separated)"
                          value={(item.tags || []).join(", ")}
                          onChange={(v) => {
                            const items = [...(content as any).services.items];
                            items[idx] = { ...items[idx], tags: v.split(",").map((t: string) => t.trim()).filter(Boolean) };
                            setContent({ ...content, services: { ...(content as any).services, items } });
                          }}
                        />
                      </div>
                    ))}
                  </ContentSection>

                  <ContentSection title="Mentoring">
                    <ContentField
                      label="Heading"
                      value={(content as any).mentoring?.heading}
                      onChange={(v) =>
                        setContent({ ...content, mentoring: { ...(content as any).mentoring, heading: v } })
                      }
                    />
                    <ContentField
                      label="Subtext"
                      value={(content as any).mentoring?.subtext}
                      onChange={(v) =>
                        setContent({ ...content, mentoring: { ...(content as any).mentoring, subtext: v } })
                      }
                      textarea
                    />
                    <ContentField
                      label="Card 1 Title"
                      value={(content as any).mentoring?.card1Title}
                      onChange={(v) =>
                        setContent({ ...content, mentoring: { ...(content as any).mentoring, card1Title: v } })
                      }
                    />
                    <ContentField
                      label="Card 1 Items (one per line)"
                      value={(content as any).mentoring?.card1Items?.join("\n") || ""}
                      onChange={(v) =>
                        setContent({
                          ...content,
                          mentoring: {
                            ...(content as any).mentoring,
                            card1Items: v.split("\n").filter((x: string) => x.trim()),
                          },
                        })
                      }
                      textarea
                    />
                    <ContentField
                      label="Card 2 Title"
                      value={(content as any).mentoring?.card2Title}
                      onChange={(v) =>
                        setContent({ ...content, mentoring: { ...(content as any).mentoring, card2Title: v } })
                      }
                    />
                    <ContentField
                      label="Card 2 Items (one per line)"
                      value={(content as any).mentoring?.card2Items?.join("\n") || ""}
                      onChange={(v) =>
                        setContent({
                          ...content,
                          mentoring: {
                            ...(content as any).mentoring,
                            card2Items: v.split("\n").filter((x: string) => x.trim()),
                          },
                        })
                      }
                      textarea
                    />
                  </ContentSection>

                  <ContentSection title="Sliding Scale Options">
                    <ContentField
                      label="Price options (one per line)"
                      value={(content as any).slidingScale?.join("\n") || ""}
                      onChange={(v) =>
                        setContent({
                          ...content,
                          slidingScale: v.split("\n").filter((x: string) => x.trim()),
                        })
                      }
                      textarea
                    />
                  </ContentSection>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────
function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-xl border border-sage/15 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between font-sans text-sm font-medium text-forest"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-forest/30" /> : <ChevronDown className="w-4 h-4 text-forest/30" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContentField({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  const Tag = textarea ? "textarea" : "input";
  return (
    <div>
      <label className="font-sans text-xs font-medium text-forest/50 uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <Tag
        value={value || ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
        rows={textarea ? 4 : undefined}
        className="w-full bg-cream border-2 border-sage/15 rounded-lg px-4 py-2.5 font-sans text-sm text-forest focus:outline-none focus:border-clay/40 transition-colors resize-none"
      />
    </div>
  );
}
