import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { Scene } from '../../shaders/spark-badge/Scene';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { navigate } = useRouter();

  const handleSignIn = () => {
    navigate(isAuthenticated ? '/dashboard' : '/login');
  };

  return (
    <div className="relative w-screen h-screen min-h-screen bg-black overflow-hidden select-none">
      {/* Complete Fullscreen ThreeUI SparkBadge Canvas Scene */}
      <Scene
        speed={1.00}
        particleAmount={1.00}
        rainAmount={1.00}
        turbulence={1.00}
        spread={1.00}
      />

      {/* Floating Sign In Tab */}
      <div className="fixed top-6 right-6 z-30 pointer-events-auto">
        <button
          onClick={handleSignIn}
          id="sign-in-tab"
          aria-label="Sign In"
          className="group flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-semibold tracking-wider uppercase backdrop-blur-md border border-white/15 hover:border-kali-primary transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_4px_24px_rgba(0,0,0,0.8)]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-kali-cyan animate-pulse" />
          <span>{isAuthenticated ? 'SOC Console' : 'Sign In'}</span>
          <ArrowRight className="h-3.5 w-3.5 text-kali-cyan group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
