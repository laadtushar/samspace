"use client";

import { useState, useEffect, useRef, useMemo, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  LogOut,
  Users,
  FileText,
  Newspaper,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Check,
  Download,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Upload,
  AlertCircle,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { slugify, readingMinutes, type BlogPost } from "@/lib/blog";
import { SLUG_PATTERN } from "@/lib/validation";

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
  studentConfirmed?: boolean;
  scheduling?: string;
}

/** The editor keeps tags as raw text so a half-typed comma list isn't destroyed. */
interface PostForm {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  coverAlt: string;
  tagsText: string;
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  publishedAt: string;
}

const emptyPost = (): PostForm => ({
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  coverAlt: "",
  tagsText: "",
  status: "draft",
  seoTitle: "",
  seoDescription: "",
  publishedAt: "",
});

const toForm = (post: BlogPost): PostForm => ({
  id: post.id,
  slug: post.slug,
  title: post.title,
  excerpt: post.excerpt,
  content: post.content,
  coverImage: post.coverImage,
  coverAlt: post.coverAlt,
  tagsText: (post.tags || []).join(", "),
  status: post.status,
  seoTitle: post.seoTitle,
  seoDescription: post.seoDescription,
  publishedAt: post.publishedAt,
});

const parseTags = (text: string) =>
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** Marks a 401 so callers can drop back to the login screen instead of showing an error. */
class SessionExpired extends Error {}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // Non-JSON error bodies (proxy/HTML error pages) fall through to the fallback.
  }
  return fallback;
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401) throw new SessionExpired();
  return res;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  if (!res.ok) {
    throw new Error(await errorMessage(res, `Request failed (${res.status})`));
  }
  return res.json() as Promise<T>;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<"submissions" | "content" | "blog">("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateMessage, setMigrateMessage] = useState("");

  // ─── Blog editor state ───────────────────────────
  const [blogView, setBlogView] = useState<"list" | "editor">("list");
  const [form, setForm] = useState<PostForm>(emptyPost);
  /** Slug the post was loaded under — null while creating. Drives `previousSlug`. */
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [postSaving, setPostSaving] = useState(false);
  const [postError, setPostError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const baselineRef = useRef("");

  const endSession = useCallback(() => {
    setAuthed(false);
    setPassword("");
    setSubmissions([]);
    setContent(null);
    setPosts([]);
    setBlogView("list");
    setAuthError("Your session expired — please log in again.");
  }, []);

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
        setPassword("");
      } else {
        setAuthError(await errorMessage(res, "Invalid password"));
      }
    } catch {
      setAuthError("Connection error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } catch {
      // The cookie may already be gone; the UI must return to the login screen regardless.
    }
    setAuthed(false);
    setPassword("");
    setSubmissions([]);
    setContent(null);
    setPosts([]);
    setBlogView("list");
    setAuthError("");
  };

  // A refresh shouldn't force a re-login — the cookie outlives the React state.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/auth")
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((d) => {
        if (!cancelled) setAuthed(Boolean(d?.authenticated));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    Promise.all([
      apiJson<Submission[]>("/api/admin/submissions"),
      apiJson<Record<string, unknown>>("/api/admin/content"),
      apiJson<BlogPost[]>("/api/admin/blog"),
    ])
      .then(([subs, cont, blog]) => {
        if (cancelled) return;
        setSubmissions(Array.isArray(subs) ? subs : []);
        setContent(cont);
        setPosts(Array.isArray(blog) ? blog : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof SessionExpired) {
          endSession();
          return;
        }
        // Without this the dashboard would render an empty list, which reads as
        // "nobody has booked" rather than "the request failed".
        setLoadError(err instanceof Error ? err.message : "Could not load dashboard data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authed, endSession]);

  const handleSaveContent = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await apiFetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      if (!res.ok) {
        setSaveError(await errorMessage(res, "Could not save changes"));
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      if (err instanceof SessionExpired) endSession();
      else setSaveError("Connection error — nothing was saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateMessage("");
    try {
      const res = await apiFetch("/api/admin/migrate", { method: "POST" });
      const body = await res.json().catch(() => null);
      setMigrateMessage(
        res.ok
          ? body?.message || "Migration finished."
          : body?.error || "Migration failed."
      );
    } catch (err) {
      if (err instanceof SessionExpired) endSession();
      else setMigrateMessage("Connection error — nothing was migrated.");
    } finally {
      setMigrating(false);
    }
  };

  // ─── Blog actions ────────────────────────────────
  const dirty = useMemo(
    () => blogView === "editor" && JSON.stringify(form) !== baselineRef.current,
    [blogView, form]
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const confirmDiscard = () =>
    !dirty || window.confirm("This post has unsaved changes. Discard them?");

  const openEditor = (post?: BlogPost) => {
    const next = post ? toForm(post) : emptyPost();
    baselineRef.current = JSON.stringify(next);
    setForm(next);
    setEditingSlug(post ? post.slug : null);
    setSlugTouched(Boolean(post));
    setFormErrors({});
    setPostError("");
    setUploadError("");
    setBlogView("editor");
  };

  const closeEditor = () => {
    if (!confirmDiscard()) return;
    setBlogView("list");
    setPostError("");
  };

  const switchTab = (next: "submissions" | "content" | "blog") => {
    if (tab === "blog" && next !== "blog" && !confirmDiscard()) return;
    if (tab === "blog" && next !== "blog") setBlogView("list");
    setTab(next);
  };

  const setField = <K extends keyof PostForm>(key: K, value: PostForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleTitleChange = (value: string) => {
    setForm((f) => ({
      ...f,
      title: value,
      // Only a brand-new, untouched slug follows the title; an existing post's
      // URL must never move on its own.
      slug: editingSlug === null && !slugTouched ? slugify(value) : f.slug,
    }));
  };

  const validate = (f: PostForm): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!f.title.trim()) errors.title = "Title is required";
    if (!f.slug.trim()) errors.slug = "Slug is required";
    else if (!SLUG_PATTERN.test(f.slug.trim()))
      errors.slug = "Slug may contain lowercase letters, numbers and hyphens only";
    if (!f.content.trim()) errors.content = "Post content is required";
    if (parseTags(f.tagsText).length > 12) errors.tags = "Twelve tags at most";
    return errors;
  };

  const savePost = async (override?: Partial<PostForm>) => {
    const candidate = { ...form, ...override };
    const errors = validate(candidate);
    setFormErrors(errors);
    if (Object.keys(errors).length) return false;

    setPostSaving(true);
    setPostError("");
    try {
      const res = await apiFetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: candidate.id,
          slug: candidate.slug.trim(),
          title: candidate.title.trim(),
          excerpt: candidate.excerpt,
          content: candidate.content,
          coverImage: candidate.coverImage,
          coverAlt: candidate.coverAlt,
          tags: parseTags(candidate.tagsText),
          status: candidate.status,
          seoTitle: candidate.seoTitle,
          seoDescription: candidate.seoDescription,
          publishedAt: candidate.publishedAt,
          ...(editingSlug ? { previousSlug: editingSlug } : {}),
        }),
      });
      if (!res.ok) {
        setPostError(await errorMessage(res, "Could not save this post"));
        return false;
      }
      const { post } = (await res.json()) as { post: BlogPost };
      setPosts((prev) => {
        const rest = prev.filter(
          (p) => p.slug !== post.slug && p.slug !== editingSlug
        );
        return [post, ...rest].sort((a, b) =>
          (b.publishedAt || b.updatedAt).localeCompare(a.publishedAt || a.updatedAt)
        );
      });
      const savedForm = toForm(post);
      baselineRef.current = JSON.stringify(savedForm);
      setForm(savedForm);
      setEditingSlug(post.slug);
      setSlugTouched(true);
      return true;
    } catch (err) {
      if (err instanceof SessionExpired) endSession();
      else setPostError("Connection error — nothing was saved.");
      return false;
    } finally {
      setPostSaving(false);
    }
  };

  const togglePublish = async (post: BlogPost) => {
    setBusySlug(post.slug);
    setPostError("");
    try {
      const res = await apiFetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...post,
          status: post.status === "published" ? "draft" : "published",
          previousSlug: post.slug,
        }),
      });
      if (!res.ok) {
        setPostError(await errorMessage(res, "Could not update this post"));
        return;
      }
      const { post: updated } = (await res.json()) as { post: BlogPost };
      setPosts((prev) => prev.map((p) => (p.slug === post.slug ? updated : p)));
    } catch (err) {
      if (err instanceof SessionExpired) endSession();
      else setPostError("Connection error — nothing was changed.");
    } finally {
      setBusySlug(null);
    }
  };

  const deletePost = async (slug: string) => {
    setBusySlug(slug);
    setPostError("");
    try {
      const res = await apiFetch(`/api/admin/blog?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setPostError(await errorMessage(res, "Could not delete this post"));
        return;
      }
      setPosts((prev) => prev.filter((p) => p.slug !== slug));
      setConfirmDelete(null);
    } catch (err) {
      if (err instanceof SessionExpired) endSession();
      else setPostError("Connection error — nothing was deleted.");
    } finally {
      setBusySlug(null);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await apiFetch("/api/admin/upload", { method: "POST", body: data });
      if (!res.ok) {
        setUploadError(await errorMessage(res, "Upload failed"));
        return;
      }
      const { url } = (await res.json()) as { url: string };
      setField("coverImage", url);
    } catch (err) {
      if (err instanceof SessionExpired) endSession();
      else setUploadError("Connection error — the image was not uploaded.");
    } finally {
      setUploading(false);
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
      "studentConfirmed",
      "scheduling",
    ];
    // Anything a stranger typed can land in a spreadsheet cell. A value opening
    // with =, +, - or @ is read as a formula by Excel and Sheets, so =HYPERLINK(..)
    // in a name field would execute when Priyanka opens her own export. Prefixing
    // a quote makes the cell literal text.
    const cell = (value: unknown) => {
      const text = String(value ?? "");
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csv = [
      fields.join(","),
      ...submissions.map((s) =>
        fields
          .map((f) => cell((s as unknown as Record<string, unknown>)[f]))
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

  const wordCount = form.content.trim() ? form.content.trim().split(/\s+/).length : 0;

  // ─── Session check ───────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-forest flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-cream/50" />
      </div>
    );
  }

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
            onClick={handleLogout}
            className="font-sans text-xs text-cream/60 hover:text-cream flex items-center gap-1 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-16">
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: "submissions" as const, label: "Intake Submissions", icon: Users, count: submissions.length },
            { id: "content" as const, label: "Edit Content", icon: FileText },
            { id: "blog" as const, label: "Blog", icon: Newspaper, count: posts.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
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

        {loadError && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-sans text-sm text-red-700">{loadError}</p>
              <p className="font-sans text-xs text-red-500/80 mt-0.5">
                This is a loading failure, not an empty dashboard — reload to try again.
              </p>
            </div>
          </div>
        )}

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

                {submissions.length === 0 && !loadError ? (
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
                              <p className="font-sans text-sm font-medium text-forest flex items-center gap-2">
                                {s.name}
                                {s.scheduling === "booked" && (
                                  <span className="font-sans text-[10px] uppercase tracking-wider bg-clay/15 text-clay px-2 py-0.5 rounded-full">
                                    Slot booked
                                  </span>
                                )}
                                {s.studentConfirmed && (
                                  <span className="font-sans text-[10px] uppercase tracking-wider bg-sage/20 text-forest/60 px-2 py-0.5 rounded-full">
                                    Student
                                  </span>
                                )}
                              </p>
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
                                    [
                                      "Student Confirmed",
                                      s.studentConfirmed ? "Yes" : "",
                                    ],
                                    [
                                      "Scheduling",
                                      s.scheduling === "booked"
                                        ? "Slot booked"
                                        : s.scheduling === "skipped"
                                          ? "Skipped"
                                          : "",
                                    ],
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

                {/* Legacy storage cleanup — a one-off, so it stays out of the way. */}
                <div className="mt-10 pt-6 border-t border-sage/15">
                  <p className="font-sans text-xs text-forest/40 mb-2 max-w-xl leading-relaxed">
                    Older submissions were stored in public storage. This moves any
                    that remain into private storage and removes the public copy.
                    Safe to run more than once.
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleMigrate}
                      disabled={migrating}
                      className="font-sans text-xs text-forest/50 hover:text-forest flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sage/20 hover:border-sage/40 transition-colors disabled:opacity-60"
                    >
                      {migrating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      Migrate legacy submissions
                    </button>
                    {migrateMessage && (
                      <span className="font-sans text-xs text-forest/50">{migrateMessage}</span>
                    )}
                  </div>
                </div>
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

                {saveError && (
                  <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="font-sans text-sm text-red-700">{saveError}</p>
                  </div>
                )}

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

                  <ContentSection title="Session Rates">
                    <ContentField
                      label="Rates, one per line — add (Student) to mark the concessional rate"
                      value={(content as any).slidingScale?.join("\n") || ""}
                      onChange={(v) =>
                        setContent({
                          ...content,
                          slidingScale: v.split("\n").filter((x: string) => x.trim()),
                        })
                      }
                      textarea
                    />
                    <ContentField
                      label="Student rate note (shown when a student rate is picked)"
                      value={(content as any).studentNote || ""}
                      onChange={(v) => setContent({ ...content, studentNote: v })}
                      textarea
                    />
                  </ContentSection>

                  <ContentSection title="Scheduling (Calendly)">
                    <CalendlySettings
                      value={((content as any).calendlyUrl as string) || ""}
                      onChange={(v) => setContent({ ...content, calendlyUrl: v })}
                    />
                  </ContentSection>
                </div>
              </div>
            )}

            {/* ─── Blog Tab ─────────────────────── */}
            {tab === "blog" && blogView === "list" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-xl font-semibold text-forest">Blog Posts</h2>
                  <button
                    onClick={() => openEditor()}
                    className="font-sans text-sm font-medium bg-forest text-cream px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-forest-deep transition-colors"
                  >
                    <Plus className="w-4 h-4" /> New Post
                  </button>
                </div>

                {postError && (
                  <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="font-sans text-sm text-red-700">{postError}</p>
                  </div>
                )}

                {posts.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-2xl border border-sage/15">
                    <Newspaper className="w-10 h-10 text-sage/30 mx-auto mb-3" />
                    <p className="font-sans text-sm text-forest/40">No posts yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posts.map((p) => (
                      <div
                        key={p.slug}
                        className="bg-white rounded-xl border border-sage/15 px-5 py-4 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-serif text-base font-semibold text-forest truncate">
                              {p.title || "Untitled"}
                            </p>
                            <span
                              className={`font-sans text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                p.status === "published"
                                  ? "bg-clay/15 text-clay"
                                  : "bg-sage/20 text-forest/50"
                              }`}
                            >
                              {p.status === "published" ? "Published" : "Draft"}
                            </span>
                          </div>
                          <p className="font-sans text-xs text-forest/40 mt-0.5">
                            /blog/{p.slug}
                            &nbsp;·&nbsp;updated{" "}
                            {new Date(p.updatedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {busySlug === p.slug && (
                            <Loader2 className="w-4 h-4 animate-spin text-forest/40" />
                          )}
                          <button
                            onClick={() => togglePublish(p)}
                            disabled={busySlug === p.slug}
                            className="font-sans text-xs text-forest/50 hover:text-forest flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sage/20 hover:border-sage/40 transition-colors disabled:opacity-60"
                          >
                            {p.status === "published" ? (
                              <><EyeOff className="w-3.5 h-3.5" /> Unpublish</>
                            ) : (
                              <><Eye className="w-3.5 h-3.5" /> Publish</>
                            )}
                          </button>
                          <button
                            onClick={() => openEditor(p)}
                            className="font-sans text-xs text-forest/50 hover:text-forest flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sage/20 hover:border-sage/40 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          {confirmDelete === p.slug ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => deletePost(p.slug)}
                                disabled={busySlug === p.slug}
                                className="font-sans text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
                              >
                                Delete for good
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="font-sans text-xs text-forest/40 hover:text-forest px-2 py-2 rounded-lg transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(p.slug)}
                              className="font-sans text-xs text-red-500/70 hover:text-red-600 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200/60 hover:border-red-300 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "blog" && blogView === "editor" && (
              <div>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <button
                    onClick={closeEditor}
                    className="font-sans text-xs text-forest/50 hover:text-forest flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> All posts
                  </button>
                  <div className="flex items-center gap-2">
                    {dirty && (
                      <span className="font-sans text-xs text-forest/40">Unsaved changes</span>
                    )}
                    <button
                      onClick={() => savePost()}
                      disabled={postSaving}
                      className="font-sans text-sm font-medium bg-forest text-cream px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-forest-deep transition-colors disabled:opacity-60"
                    >
                      {postSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><Save className="w-4 h-4" /> Save Post</>
                      )}
                    </button>
                    {form.status === "draft" && (
                      <button
                        onClick={async () => {
                          setField("status", "published");
                          await savePost({ status: "published" });
                        }}
                        disabled={postSaving}
                        className="font-sans text-sm font-medium bg-clay text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                      >
                        <Eye className="w-4 h-4" /> Publish
                      </button>
                    )}
                  </div>
                </div>

                {postError && (
                  <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="font-sans text-sm text-red-700">{postError}</p>
                  </div>
                )}

                <div className="space-y-6">
                  <ContentSection title="Post">
                    <ContentField
                      label="Title"
                      value={form.title}
                      onChange={handleTitleChange}
                      error={formErrors.title}
                    />
                    <ContentField
                      label="Slug (the URL: /blog/…)"
                      value={form.slug}
                      onChange={(v) => {
                        setSlugTouched(true);
                        setField("slug", v);
                      }}
                      error={formErrors.slug}
                    />
                    <ContentField
                      label="Excerpt (left blank, the first paragraph is used)"
                      value={form.excerpt}
                      onChange={(v) => setField("excerpt", v)}
                      textarea
                    />
                    <ContentField
                      label="Content (Markdown)"
                      value={form.content}
                      onChange={(v) => setField("content", v)}
                      textarea
                      rows={22}
                      error={formErrors.content}
                    />
                    <p className="font-sans text-xs text-forest/40">
                      {wordCount.toLocaleString()} words · {form.content.length.toLocaleString()} characters ·{" "}
                      {readingMinutes(form.content)} min read
                    </p>
                  </ContentSection>

                  <ContentSection title="Cover Image">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="font-sans text-xs text-forest/50 hover:text-forest flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sage/20 hover:border-sage/40 transition-colors cursor-pointer">
                        {uploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {uploading ? "Uploading…" : "Upload image"}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploading}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            // Resetting lets the same file be re-picked after a failed upload.
                            e.target.value = "";
                            if (file) handleUpload(file);
                          }}
                        />
                      </label>
                      {form.coverImage && (
                        <button
                          onClick={() => setField("coverImage", "")}
                          className="font-sans text-xs text-forest/40 hover:text-forest transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {uploadError && (
                      <p className="font-sans text-xs text-red-500">{uploadError}</p>
                    )}
                    {form.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.coverImage}
                        alt={form.coverAlt || "Cover preview"}
                        className="w-full max-w-sm rounded-xl border border-sage/15 object-cover"
                      />
                    )}
                    <ContentField
                      label="Cover image URL"
                      value={form.coverImage}
                      onChange={(v) => setField("coverImage", v)}
                    />
                    <ContentField
                      label="Cover alt text (describes the image for screen readers)"
                      value={form.coverAlt}
                      onChange={(v) => setField("coverAlt", v)}
                    />
                  </ContentSection>

                  <ContentSection title="Tags & SEO">
                    <ContentField
                      label="Tags (comma-separated)"
                      value={form.tagsText}
                      onChange={(v) => setField("tagsText", v)}
                      error={formErrors.tags}
                    />
                    <ContentField
                      label="SEO title (falls back to the post title)"
                      value={form.seoTitle}
                      onChange={(v) => setField("seoTitle", v)}
                    />
                    <ContentField
                      label="SEO description"
                      value={form.seoDescription}
                      onChange={(v) => setField("seoDescription", v)}
                      textarea
                    />
                  </ContentSection>

                  <ContentSection title="Status">
                    <div className="flex gap-2">
                      {(["draft", "published"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setField("status", s)}
                          className={`font-sans text-sm px-5 py-2.5 rounded-xl transition-all ${
                            form.status === s
                              ? "bg-forest text-cream"
                              : "bg-cream text-forest/60 border border-sage/20 hover:bg-forest/5"
                          }`}
                        >
                          {s === "draft" ? "Draft" : "Published"}
                        </button>
                      ))}
                    </div>
                    <p className="font-sans text-xs text-forest/40">
                      Drafts stay off the public blog. Published posts appear at{" "}
                      <code className="text-forest/60">/blog/{form.slug || "your-slug"}</code>{" "}
                      right after saving.
                    </p>
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

// ─── Calendly Integration ───────────────────────────
// A blank link keeps the scheduling step out of the intake form entirely, so
// this panel doubles as the on/off switch for the whole integration.
function CalendlySettings({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const trimmed = value.trim();
  let status: "off" | "valid" | "invalid" = "off";
  if (trimmed) {
    try {
      const url = new URL(trimmed);
      status = url.protocol === "https:" && /(^|\.)calendly\.com$/.test(url.hostname)
        ? "valid"
        : "invalid";
    } catch {
      status = "invalid";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            status === "valid"
              ? "bg-green-500"
              : status === "invalid"
                ? "bg-red-400"
                : "bg-sage/40"
          }`}
        />
        <span className="font-sans text-xs text-forest/60">
          {status === "valid"
            ? "Connected — the intake form opens with an optional booking step."
            : status === "invalid"
              ? "That doesn't look like a Calendly link — the step stays hidden until it's fixed."
              : "Off — the intake form skips scheduling entirely."}
        </span>
      </div>

      <ContentField
        label="Calendly event link"
        value={value}
        onChange={(v) => onChange(v.trim())}
      />

      <div className="bg-cream rounded-lg p-4 space-y-2">
        <p className="font-sans text-[11px] text-forest/50 leading-relaxed">
          Paste the scheduling link for the event you want people to book — from
          Calendly, open the event and use <strong>Copy link</strong>. It looks
          like <code className="text-forest/70">https://calendly.com/your-name/50min</code>.
          Clear this box to turn scheduling off again.
        </p>
        <p className="font-sans text-[11px] text-forest/50 leading-relaxed">
          Booking is always optional — people can skip it and still submit the
          form. When someone does book, their confirmation email says so and the
          submission is tagged <strong>Slot booked</strong> below.
        </p>
      </div>

      {status === "valid" && (
        <div className="rounded-xl overflow-hidden border border-sage/20 bg-white">
          <p className="font-sans text-[10px] text-forest/40 uppercase tracking-wider px-4 pt-3 pb-2">
            Preview
          </p>
          <iframe
            src={trimmed}
            title="Calendly preview"
            className="w-full h-[360px] border-0"
          />
        </div>
      )}
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
  rows,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  error?: string;
}) {
  const Tag = textarea ? "textarea" : "input";
  // Tying the label to the control keeps the field reachable by name, for
  // screen readers and for anyone driving the dashboard by keyboard.
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label
        htmlFor={id}
        className="font-sans text-xs font-medium text-forest/50 uppercase tracking-wider mb-1.5 block"
      >
        {label}
      </label>
      <Tag
        id={id}
        value={value || ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
        rows={textarea ? rows ?? 4 : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full bg-cream border-2 rounded-lg px-4 py-2.5 font-sans text-sm text-forest focus:outline-none transition-colors resize-none ${
          error
            ? "border-red-300 focus:border-red-400"
            : "border-sage/15 focus:border-clay/40"
        }`}
      />
      {error && (
        <p id={errorId} className="font-sans text-xs text-red-500 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
