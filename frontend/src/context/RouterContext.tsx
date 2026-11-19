import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { PlatformTab } from './SecurityPlatformContext';
import { ROUTE_TAB_MAP, TAB_ROUTE_MAP, normalizePath, isKnownRoute } from './routes';

export { ROUTE_TAB_MAP, TAB_ROUTE_MAP, normalizePath, isKnownRoute };

interface RouterContextValue {
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  activeTab: PlatformTab;
  setActiveTab: (tab: PlatformTab, options?: { replace?: boolean }) => void;
  isLandingPage: boolean;
  isLoginPage: boolean;
  isDashboardRoute: boolean;
  isNotFound: boolean;
}

const RouterContext = createContext<RouterContextValue | undefined>(undefined);

export const RouterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pathname, setPathname] = useState<string>(() => {
    return typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/';
  });

  const [activeTab, setActiveTabInternal] = useState<PlatformTab>(() => {
    const norm = typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/';
    return ROUTE_TAB_MAP[norm] || 'overview';
  });

  // Listen to browser navigation (back/forward and hash changes)
  useEffect(() => {
    const handlePopState = () => {
      const current = normalizePath(window.location.pathname);
      setPathname(current);
      if (ROUTE_TAB_MAP[current]) {
        setActiveTabInternal(ROUTE_TAB_MAP[current]);
        const el = document.getElementById(ROUTE_TAB_MAP[current]);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        const id = hash.substring(1);
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;

    // Handle hash navigation on current page or root
    if (to.startsWith('#') || to.startsWith('/#')) {
      const hashPart = to.includes('#') ? to.substring(to.indexOf('#') + 1) : '';
      const currentNorm = normalizePath(window.location.pathname);

      if (currentNorm === '/' || currentNorm === '/dashboard') {
        const el = document.getElementById(hashPart);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.history.pushState(null, '', `#${hashPart}`);
        }
        return;
      }

      window.history.pushState(null, '', `/#${hashPart}`);
      setPathname('/');
      setTimeout(() => {
        const el = document.getElementById(hashPart);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
      return;
    }

    // Handle external or API doc paths
    if (to.startsWith('http://') || to.startsWith('https://')) {
      window.open(to, '_blank', 'noopener,noreferrer');
      return;
    }

    if (to === '/docs' || to.startsWith('/docs/') || to === '/redoc' || to.startsWith('/redoc/')) {
      window.location.href = to;
      return;
    }

    const norm = normalizePath(to);
    if (options?.replace) {
      window.history.replaceState(null, '', to);
    } else {
      window.history.pushState(null, '', to);
    }
    setPathname(norm);

    if (ROUTE_TAB_MAP[norm]) {
      setActiveTabInternal(ROUTE_TAB_MAP[norm]);
      // If navigating to a dashboard route, scroll to that section
      setTimeout(() => {
        const tab = ROUTE_TAB_MAP[norm];
        const el = document.getElementById(tab);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    } else if (norm === '/' || norm === '/login') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const setActiveTab = useCallback(
    (tab: PlatformTab, options?: { replace?: boolean }) => {
      setActiveTabInternal(tab);
      const targetRoute = TAB_ROUTE_MAP[tab] || '/dashboard';
      if (typeof window !== 'undefined' && normalizePath(window.location.pathname) !== targetRoute) {
        if (options?.replace) {
          window.history.replaceState(null, '', targetRoute);
        } else {
          window.history.pushState(null, '', targetRoute);
        }
        setPathname(targetRoute);
      }
    },
    []
  );

  const isLandingPage = pathname === '/';
  const isLoginPage = pathname === '/login';
  const isDashboardRoute = pathname.startsWith('/dashboard') || !!ROUTE_TAB_MAP[pathname];
  const isNotFound = !isLandingPage && !isLoginPage && !isDashboardRoute;

  return (
    <RouterContext.Provider
      value={{
        pathname,
        navigate,
        activeTab,
        setActiveTab,
        isLandingPage,
        isLoginPage,
        isDashboardRoute,
        isNotFound,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = (): RouterContextValue => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};

export default RouterContext;
