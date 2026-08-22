import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — InvoiceFlow" },
      {
        name: "description",
        content: "Sign in to your InvoiceFlow account",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get ID token
      const token = await user.getIdToken();

      // Store token in localStorage for API requests
      localStorage.setItem("firebaseToken", token);
      localStorage.setItem("userEmail", user.email || "");

      // Redirect based on email (demo logic)
      if (email === "procurement@demo.com") {
        navigate({ to: "/procurement/dashboard" });
      } else if (email === "finance@demo.com") {
        navigate({ to: "/finance/dashboard" });
      } else {
        navigate({ to: "/" });
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your email and password.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      const user = userCredential.user;
      const token = await user.getIdToken();

      localStorage.setItem("firebaseToken", token);
      localStorage.setItem("userEmail", user.email || "");

      if (demoEmail === "procurement@demo.com") {
        navigate({ to: "/procurement/dashboard" });
      } else if (demoEmail === "finance@demo.com") {
        navigate({ to: "/finance/dashboard" });
      }
    } catch (err: any) {
      setError(err.message || "Demo login failed.");
      console.error("Demo login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 md:p-6">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <span className="grid size-12 place-items-center rounded-xl bg-blue-600 text-white">
              <ShieldCheck className="size-6" />
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">InvoiceFlow</h1>
          <p className="mt-2 text-sm text-slate-400">Invoice Risk & Approval Workspace</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl bg-slate-800 p-8 shadow-2xl border border-slate-700">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-600"></div>
            <span className="text-xs text-slate-400">Or use demo account</span>
            <div className="flex-1 h-px bg-slate-600"></div>
          </div>

          {/* Demo Login Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleDemoLogin("procurement@demo.com", "Demo@12345")}
              disabled={loading}
              className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 text-sm font-medium transition-colors"
            >
              Login as Procurement Officer
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin("finance@demo.com", "Demo@12345")}
              disabled={loading}
              className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 text-sm font-medium transition-colors"
            >
              Login as Finance Manager
            </button>
          </div>

          {/* Info Box */}
          <div className="mt-6 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-200">
            <p className="font-semibold mb-1">Demo Credentials:</p>
            <p>Procurement: procurement@demo.com</p>
            <p>Finance: finance@demo.com</p>
            <p className="mt-2">Password: Demo@12345</p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-400">
          © 2024 InvoiceFlow. All rights reserved.
        </p>
      </div>
    </div>
  );
}
