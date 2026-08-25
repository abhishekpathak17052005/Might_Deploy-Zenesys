import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Wallet, Boxes, Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InvoiceFlow — Invoice Risk & Approval Workspace" },
      {
        name: "description",
        content:
          "Submit vendor bills, track extraction and verification, and review risk evidence before approving payment.",
      },
      { property: "og:title", content: "InvoiceFlow — Invoice Risk & Approval Workspace" },
      {
        property: "og:description",
        content:
          "Procurement submits bills, the engine extracts and scores risk, finance approves with evidence.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"procurement" | "finance" | null>(null);

  return (
    <>
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto grid max-w-[1100px] gap-6 rounded-4xl bg-surface p-6 shadow-[var(--shadow-shell)] md:grid-cols-2 md:p-10">
          <div className="flex flex-col justify-between gap-8">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ShieldCheck className="size-5" />
              </span>
              <span className="text-lg font-extrabold tracking-tight">InvoiceFlow</span>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                Don't just show the invoice.
                <span className="block text-primary">Show why to trust it.</span>
              </h1>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                Document intake, extraction, categorization, GST / vendor / PO checks, risk scoring
                and related-invoice analysis — surfaced as evidence for the finance decision.
              </p>
            </div>
            <div className="rounded-3xl bg-primary-deep p-6 text-primary-foreground">
              <p className="text-xs font-semibold text-white/60">Combined PO utilization detected</p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight">95%</p>
              <p className="mt-2 text-xs text-white/70">
                INV-1023 + INV-1024 · same vendor · same PO · within 24 hours
              </p>
            </div>
          </div>

          <div className="card-surface flex flex-col gap-4 p-6">
            <div>
              <h2 className="text-sm font-bold">Continue as</h2>
              <p className="text-xs text-muted-foreground">Select your role to sign in</p>
            </div>

            <RoleCard
              onClick={() => {
                setSelectedRole("procurement");
                setShowAuthModal(true);
              }}
              icon={<Boxes className="size-5" />}
              title="Procurement Officer"
              desc="Submit vendor bills and track processing status."
            />
            <RoleCard
              onClick={() => {
                setSelectedRole("finance");
                setShowAuthModal(true);
              }}
              icon={<Wallet className="size-5" />}
              title="Finance Manager"
              desc="Review risk evidence, approve or reject payment."
              highlight
            />

            <div className="mt-auto rounded-2xl bg-muted p-4 text-xs text-muted-foreground">
              Risk scores, GST results, PO matching and categorization are produced by the backend.
              This interface only visualizes them.
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal 
          role={selectedRole} 
          onClose={() => {
            setShowAuthModal(false);
            setSelectedRole(null);
          }} 
        />
      )}
    </>
  );
}

function RoleCard({
  onClick,
  icon,
  title,
  desc,
  highlight,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-4 rounded-2xl border p-4 transition-colors text-left ${
        highlight
          ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border hover:bg-muted"
      }`}
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-xl ${
          highlight ? "bg-white/15" : "bg-muted"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className={`block text-xs ${highlight ? "text-white/70" : "text-muted-foreground"}`}>
          {desc}
        </span>
      </span>
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function AuthModal({ role, onClose }: { role: "procurement" | "finance" | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const demoAccounts = {
    procurement: {
      email: "procurement@demo.com",
      password: "Demo@12345",
      label: "Procurement Officer"
    },
    finance: {
      email: "finance@demo.com",
      password: "Demo@12345",
      label: "Finance Manager"
    }
  };

  const account = role ? demoAccounts[role] : null;

  const handleDemoLogin = async () => {
    if (!account) return;
    
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account.email, password: account.password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Login failed");
      }

      localStorage.setItem("token", data.data.token);
      localStorage.setItem("userEmail", account.email);
      localStorage.setItem("userId", data.data.userId);

      if (role === "procurement") {
        navigate({ to: "/procurement/dashboard" });
      } else {
        navigate({ to: "/finance/dashboard" });
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Login failed");
      }

      localStorage.setItem("token", data.data.token);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userId", data.data.userId);

      navigate({ to: email.includes("procurement") ? "/procurement/dashboard" : "/finance/dashboard" });
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (!account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{account.label}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Demo Login Section */}
        <div className="mb-6">
          <p className="mb-3 text-sm font-medium text-slate-600">Quick Demo Login</p>
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 inline size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In with Demo Account"
            )}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Email: {account.email}
            <br />
            Password: {account.password}
          </p>
        </div>

        {/* Divider */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex-1 border-t border-slate-200"></div>
          <span className="text-xs text-slate-400">OR</span>
          <div className="flex-1 border-t border-slate-200"></div>
        </div>

        {/* Custom Login Form */}
        <form onSubmit={handleCustomLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-5 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 inline size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-slate-500">
          Don't have an account? <Link to="/login" className="text-blue-600 hover:underline">Create one here</Link>
        </p>
      </div>
    </div>
  );
}
