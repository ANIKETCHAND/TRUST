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
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-transparent px-4 relative select-none text-[var(--ink)]">
        <div className="relative w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 shadow-[0_12px_36px_rgba(90,105,130,0.18),inset_0_1px_0_rgba(255,255,255,0.95)] space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-5">
            <BrandLogo size="md" />
            <div className="flex items-center gap-2 text-xs text-[var(--accent-ink)] bg-[var(--tint)] px-3 py-1 rounded-full border border-[var(--accent)]/30 font-medium font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <span>Active Session</span>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-2)] p-4 text-xs text-[var(--ink)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--accent-ink)] font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>Authenticated</span>
            </div>
            <p className="text-[var(--ink-2)] text-xs leading-relaxed">
              Signed in as <strong className="text-[var(--ink)]">{user?.username || 'admin'}</strong> with{' '}
              <strong className="text-[var(--accent-ink)] font-mono">{user?.role?.toUpperCase() || 'ADMIN'}</strong> permissions.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn w-full !h-11 !text-xs font-medium"
            >
              <Activity className="h-4 w-4" />
              <span>Go to SOC Console</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </button>

            <button
              onClick={() => navigate('/')}
              className="btn ghost w-full !h-11 !text-xs font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Landing Page</span>
            </button>

            <button
              onClick={() => {
                logout();
                setErrorMsg(null);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-[#FCA5A5] bg-[#FEF2F2] py-2.5 text-xs font-medium text-[#DC2626] hover:bg-[#FDE2E2] transition-all"
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
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-transparent px-4 relative select-none text-[var(--ink)]">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 shadow-[0_12px_36px_rgba(90,105,130,0.18),inset_0_1px_0_rgba(255,255,255,0.95)] space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-5">
          <BrandLogo size="md" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-3)] bg-[var(--bg-2)] px-2 py-0.5 rounded border border-[var(--line-2)]">
            v2.4 Live
          </span>
        </div>

        {/* Title & Guidance */}
        <div className="space-y-1">
          <h2 className="text-xl font-medium tracking-tight text-[var(--ink)]">Operator Authentication</h2>
          <p className="text-xs text-[var(--ink-2)]">
            Provide zero-trust credentials to access the CrossX SOC control plane.
          </p>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#DC2626] animate-fadeIn">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#DC2626]" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--ink-2)] flex items-center justify-between">
              <span>Username</span>
              <span className="font-mono text-[10px] text-[var(--ink-3)]">Default: admin</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-3)] pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Operator handle"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-[var(--line-2)] bg-[var(--bg)] pl-9 pr-3.5 py-2.5 text-xs text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--ink-2)] flex items-center justify-between">
              <span>Password</span>
              <span className="font-mono text-[10px] text-[var(--ink-3)]">Default: admin123</span>
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-3)] pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Secret access key"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-[var(--line-2)] bg-[var(--bg)] pl-9 pr-3.5 py-2.5 text-xs text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none transition-colors font-mono"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn w-full !h-11 !text-xs font-medium mt-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <span>Verifying Certificate...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <span>Access Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </form>

        {/* Footer info & Return to Landing */}
        <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--ink-3)]">
          <button
            onClick={() => navigate('/')}
            className="hover:text-[var(--ink)] flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Landing Page</span>
          </button>
          <span className="font-mono text-[10px]">Zero-Trust Enforced</span>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
