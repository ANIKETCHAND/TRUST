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
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#F5F7FA] px-4 relative select-none">
        <div className="relative w-full max-w-md rounded-2xl border border-[#E5EAF1] bg-white p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#E5EAF1] pb-5">
            <BrandLogo size="md" />
            <div className="flex items-center gap-2 text-xs text-[#16A34A] bg-[#E8F7EF] px-3 py-1 rounded-full border border-[#BCE8CD]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span>Active Session</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#BCE8CD] bg-[#E8F7EF]/50 p-4 text-xs text-[#1E293B] space-y-1.5">
            <div className="flex items-center gap-2 text-[#16A34A] font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>Authenticated</span>
            </div>
            <p className="text-[#64748B] text-xs leading-relaxed">
              Signed in as <strong className="text-[#1E293B]">{user?.username || 'admin'}</strong> with <strong className="text-[#3B82F6]">{user?.role?.toUpperCase() || 'ADMIN'}</strong> permissions.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3B82F6] py-2.5 text-xs font-semibold text-white hover:bg-[#2563EB] transition-all shadow-xs"
            >
              <Activity className="h-4 w-4" />
              <span>Go to Dashboard</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </button>

            <button
              onClick={() => navigate('/')}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] py-2.5 text-xs font-medium text-[#64748B] hover:text-[#1E293B] hover:border-[#CBD5E1] transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Landing Page</span>
            </button>

            <button
              onClick={() => {
                logout();
                setErrorMsg(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#FCD2D2] bg-[#FEF2F2] py-2.5 text-xs font-medium text-[#DC2626] hover:bg-[#FDE2E2] transition-all"
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
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#F5F7FA] px-4 relative select-none">
      <div className="relative w-full max-w-md rounded-2xl border border-[#E5EAF1] bg-white p-8 shadow-xl space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#E5EAF1] pb-5">
          <BrandLogo size="md" />
          <button
            onClick={() => navigate('/')}
            type="button"
            className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#1E293B] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Landing Page</span>
          </button>
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#1E293B] tracking-tight">Sign In</h2>
          <p className="text-xs text-[#64748B] mt-1">Access the AgentTrust Security Operations Console</p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-lg border border-[#FCD2D2] bg-[#FEF2F2] p-3 text-xs text-[#DC2626]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#1E293B] mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="w-full rounded-lg border border-[#E5EAF1] bg-white py-2 pl-10 pr-3 text-xs text-[#1E293B] placeholder-[#94A3B8] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1E293B] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Key className="absolute left-3.5 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full rounded-lg border border-[#E5EAF1] bg-white py-2 pl-10 pr-3 text-xs text-[#1E293B] placeholder-[#94A3B8] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#3B82F6] py-2.5 text-xs font-semibold text-white hover:bg-[#2563EB] focus:outline-none disabled:opacity-50 transition-all shadow-xs"
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
        <div className="border-t border-[#E5EAF1] pt-4 text-center">
          <div className="text-xs text-[#64748B]">
            Demo credentials: <span className="text-[#1E293B] font-mono font-medium">admin</span> / <span className="text-[#1E293B] font-mono font-medium">admin123</span>
          </div>
        </div>
      </div>
    </div>
  );
};
