import React, { useState } from 'react';
import { User, Key, AlertCircle, ArrowRight, ShieldCheck, Terminal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BrandLogo } from '../ui/BrandLogo';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const { success, error } = useToast();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Operator username and password are required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await login(username, password);
      success('Authentication Successful', `Operator session active for ${username}. Command access granted.`);
    } catch (err: any) {
      const msg = err.message || 'Access denied. Verify cryptographic credentials.';
      setErrorMsg(msg);
      error('Access Denied', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-kali-bg px-4 relative select-none">
      {/* Subtle Kali Command Center Grid Background */}
      <div className="absolute inset-0 soc-grid-bg opacity-30 pointer-events-none" />

      {/* Terminal Command Center Card */}
      <div className="relative w-full max-w-md rounded-lg border border-kali-border bg-kali-card p-8 shadow-2xl z-10">
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between border-b border-kali-border pb-4 mb-6">
          <BrandLogo size="md" />
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-kali-cyan bg-kali-bg px-2 py-1 rounded border border-kali-border">
            <span className="h-1.5 w-1.5 rounded-full bg-kali-secure animate-pulse" />
            <span>PORT: 8080</span>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mb-6 rounded border border-kali-border bg-kali-bg/80 p-3 font-mono text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 text-kali-primary font-bold">
            <Terminal className="h-3.5 w-3.5" />
            <span>SECURITY DIRECTIVE: ZERO_TRUST_RBAC</span>
          </div>
          <p className="mt-1 text-slate-400 leading-relaxed">
            Deterministic control plane access requires operator authentication with cryptographically hashed JWT authorization.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 flex items-start gap-2.5 rounded border border-kali-critical/60 bg-[#331418] p-3 text-xs text-kali-critical font-mono">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Operator Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-kali-cyan/70" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="w-full rounded border border-kali-border bg-kali-bg py-2 pl-9 pr-3 font-mono text-xs text-white placeholder-slate-600 focus:border-kali-primary focus:bg-kali-secondary focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Security Key / Password
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-kali-cyan/70" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full rounded border border-kali-border bg-kali-bg py-2 pl-9 pr-3 font-mono text-xs text-white placeholder-slate-600 focus:border-kali-primary focus:bg-kali-secondary focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-transparent bg-kali-primary py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-kali-secondaryBlue focus:outline-none focus:ring-2 focus:ring-kali-primary disabled:opacity-50 transition-all shadow-kali-glow"
          >
            {isSubmitting ? (
              <span>AUTHENTICATING OPERATOR...</span>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>AUTHORIZE ACCESS</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Default credentials hint */}
        <div className="mt-6 border-t border-kali-border pt-4 text-center">
          <div className="font-mono text-[10px] text-slate-400">
            DEMO SEED: <span className="text-white">admin</span> / <span className="text-white">admin123</span>
          </div>
          <div className="mt-1 font-mono text-[9px] text-slate-500">
            PLATFORM: AGENTTRUST v0.1.0 • KALI SOC ENGINE
          </div>
        </div>
      </div>
    </div>
  );
};
