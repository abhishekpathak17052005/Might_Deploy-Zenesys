import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Loader2, Eye, EyeOff, Mail, Lock, User } from "lucide-react";

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
  const [isSignUp, setIsSignUp] = useState(false);

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Signup state
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
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

      if (rememberMe) {
        localStorage.setItem("rememberEmail", email);
      } else {
        localStorage.removeItem("rememberEmail");
      }

      if (email.includes("procurement")) {
        navigate({ to: "/procurement/dashboard" });
      } else if (email.includes("finance")) {
        navigate({ to: "/finance/dashboard" });
      } else {
        navigate({ to: "/" });
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (signUpPassword !== signUpConfirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (signUpPassword.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signUpName,
          email: signUpEmail,
          password: signUpPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Registration failed");
      }

      localStorage.setItem("token", data.data.token);
      localStorage.setItem("userEmail", signUpEmail);
      localStorage.setItem("userId", data.data.userId);

      navigate({ to: "/procurement/dashboard" });
    } catch (err: any) {
      setError(err.message || "Registration failed");
      console.error("Signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 md:p-6 flex items-center justify-center">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <span className="grid size-14 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg">
              <ShieldCheck className="size-7" />
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-white">InvoiceFlow</h1>
          <p className="mt-2 text-sm text-slate-400">Enterprise Invoice Verification & Risk Analysis</p>
        </div>

        <div className="rounded-2xl bg-slate-800 p-8 shadow-2xl border border-slate-700 backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {isSignUp
                ? "Sign up to start using InvoiceFlow"
                : "Sign in to your account to continue"}
            </p>
          </div>

          {!isSignUp ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 size-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 size-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-300 hover:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                  />
                  <span>Remember me</span>
                </label>
                <button type="button" className="text-blue-400 hover:text-blue-300">
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Lock className="size-4" />
                    Sign In
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 size-5 text-slate-400" />
                  <input
                    type="text"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 size-5 text-slate-400" />
                  <input
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 size-5 text-slate-400" />
                  <input
                    type={showSignUpPassword ? "text" : "password"}
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-300"
                  >
                    {showSignUpPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 size-5 text-slate-400" />
                  <input
                    type={showSignUpConfirmPassword ? "text" : "password"}
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpConfirmPassword(!showSignUpConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-300"
                  >
                    {showSignUpConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !signUpName || !signUpEmail || !signUpPassword || !signUpConfirmPassword}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <User className="size-4" />
                    Create Account
                  </>
                )}
              </button>
            </form>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-600"></div>
            <span className="text-xs text-slate-400 font-medium">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
            </span>
            <div className="flex-1 h-px bg-slate-600"></div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-100 font-semibold border border-slate-600 hover:border-slate-500"
          >
            {isSignUp ? "← Back to Sign In" : "Create New Account →"}
          </button>

          {!isSignUp && (
            <div className="mt-6 rounded-lg bg-blue-500/15 border border-blue-500/30 p-4">
              <div className="flex items-start gap-3">
                <div className="text-lg">ℹ️</div>
                <div className="text-sm">
                  <p className="font-semibold text-blue-200 mb-2">Demo Credentials</p>
                  <div className="space-y-1 text-blue-100 text-xs font-mono">
                    <p><span className="text-blue-300">Procurement:</span> procurement@demo.com</p>
                    <p><span className="text-blue-300">Finance:</span> finance@demo.com</p>
                    <p><span className="text-blue-300">Password:</span> Demo@12345</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-slate-400">© 2024 InvoiceFlow. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
            <button className="hover:text-slate-400">Privacy Policy</button>
            <span>•</span>
            <button className="hover:text-slate-400">Terms of Service</button>
          </div>
        </div>
      </div>
    </div>
  );
}
