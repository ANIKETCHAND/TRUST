import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../services/api.client';

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  role: string;
  tenant_id?: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('agenttrust_token') || localStorage.getItem('access_token')
      : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('agenttrust_token') || localStorage.getItem('access_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const profile = await api.getCurrentUser();
        setUser(profile);
      } catch (err) {
        console.warn('Failed to validate active session token:', err);
        // Expired or invalid token
        api.logout();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setToken(res.access_token);
    try {
      const profile = await api.getCurrentUser();
      setUser(profile);
    } catch {
      setUser({
        id: 'session-user',
        username,
        role: 'admin',
        tenant_id: 'default_tenant',
      });
    }
  };

  const logout = () => {
    api.logout();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
