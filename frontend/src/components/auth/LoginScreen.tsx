import React, { useState } from 'react';
import { User, Key, AlertCircle, ArrowRight, ShieldCheck, ArrowLeft, Activity, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useRouter } from '../../context/RouterContext';
import { BrandLogo } from '../ui/BrandLogo';

export const LoginScreen: React.FC = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { navigate } = useRouter();
  const { success, error } = useToast();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Username and password are required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await login(username, password);
      success('Authentication Successful', `Welcome back, ${username}.`);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Access denied. Please verify your credentials.';
      setErrorMsg(msg);
      error('Access Denied', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already authenticated, show operator status and quick launch options
  if (isAuthenticated) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-black px-4 relative select-none">
        <div className="absolute inset-0 soc-grid-bg opacity-20 pointer-events-none" />

        <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <BrandLogo size="md" />
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active Session</span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>Authenticated</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Signed in as <strong className="text-white">{user?.username || 'admin'}</strong> with <strong className="text-kali-cyan">{user?.role?.toUpperCase() || 'ADMIN'}</strong> permissions.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue py-3 text-xs font-semibold text-white hover:opacity-95 transition-all shadow-kali-glow"
            >
              <Activity className="h-4 w-4" />
              <span>Go to Dashboard</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </button>

            <button
              onClick={() => navigate('/')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] py-2.5 text-xs font-medium text-slate-300 hover:text-white hover:border-white/20 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Landing Page</span>
            </button>

            <button
              onClick={() => {
                logout();
                setErrorMsg(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 py-2.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-black px-4 relative select-none">
      <div className="absolute inset-0 soc-grid-bg opacity-20 pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-10 space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <BrandLogo size="md" />
          <button
            onClick={() => navigate('/')}
            type="button"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Landing Page</span>
          </button>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Sign In</h2>
          <p className="text-xs text-slate-400 mt-1">Access the CrossX Security Operations Center</p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-xs text-white placeholder-slate-600 focus:border-kali-cyan/50 focus:bg-white/[0.06] focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Key className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-xs text-white placeholder-slate-600 focus:border-kali-cyan/50 focus:bg-white/[0.06] focus:outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-kali-primary to-kali-secondaryBlue py-3 text-xs font-semibold text-white hover:opacity-95 focus:outline-none disabled:opacity-50 transition-all shadow-kali-glow"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="border-t border-white/10 pt-4 text-center">
          <div className="text-xs text-slate-400">
            Demo credentials: <span className="text-white font-mono">admin</span> / <span className="text-white font-mono">admin123</span>
          </div>
        </div>
      </div>
    </div>
  );
};
