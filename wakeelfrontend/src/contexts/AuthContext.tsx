import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MeFeaturesResponse, User, UserRole } from '../types';
import { apiService } from '../services/api';
import { buildUserFromLoginResponse } from '../utils/authLogin';

interface AuthContextType {
  user: User | null;
  tenantId: string | null;
  features: string[];
  globalAccess: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, turnstileToken?: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasFeature: (feature: string) => boolean;
  checkAgentSubscription: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [globalAccess, setGlobalAccess] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      const savedFeatures = localStorage.getItem('meFeatures');
      
      if (token && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          if (savedFeatures) {
            const parsed = JSON.parse(savedFeatures) as MeFeaturesResponse;
            setTenantId(parsed.tenantId ?? null);
            setFeatures(parsed.features ?? []);
            setGlobalAccess(!!parsed.globalAccess);
          }
        } catch (error) {
          console.error('Error parsing saved user:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('meFeatures');
        }
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string, turnstileToken?: string) => {
    try {
      const response = await apiService.login({ username, password, turnstileToken });

      localStorage.setItem('token', response.token);

      let userData: User;
      let featuresData: MeFeaturesResponse;

      if (response.skipAgentsMeAndSync) {
        userData = buildUserFromLoginResponse(response, username);
        try {
          featuresData = await apiService.getMyFeatures({ skipAuthRedirect: true });
        } catch {
          featuresData = { features: [], globalAccess: false };
        }
      } else {
        /** أثناء التمهيد لا نستخدم إعادة التوجيه العامة عند 401 — وإلا تُفرغ الجلسة (مثلاً إن لم يدعم الباكند GET /users/me للوكيل الرئيسي) */
        const [meResult, featuresResult] = await Promise.allSettled([
          apiService.getCurrentUser({ skipAuthRedirect: true }),
          apiService.getMyFeatures({ skipAuthRedirect: true }),
        ]);
        if (meResult.status === 'fulfilled') {
          userData = meResult.value;
        } else {
          userData = buildUserFromLoginResponse(response, username);
        }
        if (featuresResult.status === 'fulfilled') {
          featuresData = featuresResult.value;
        } else {
          featuresData = { features: [], globalAccess: false };
        }
      }

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      setTenantId(featuresData.tenantId ?? null);
      setFeatures(featuresData.features ?? []);
      setGlobalAccess(!!featuresData.globalAccess);
      localStorage.setItem('meFeatures', JSON.stringify(featuresData));
    } catch (error) {
      console.error('Login error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('meFeatures');
      setUser(null);
      setTenantId(null);
      setFeatures([]);
      setGlobalAccess(false);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('meFeatures');
    setUser(null);
    setTenantId(null);
    setFeatures([]);
    setGlobalAccess(false);
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const hasFeature = (feature: string): boolean => {
    if (globalAccess) return true;
    return features.includes(feature);
  };

  const checkAgentSubscription = async (): Promise<boolean> => {
    if (!user || user.role !== UserRole.Agent) {
      return true; // Not an agent, no need to check
    }

    // For agents, we need to fetch their subscription details from the API
    // This is a simplified check - in a real app, you'd fetch the agent's subscription
    // For now, we'll assume the subscription is valid if the user is logged in
    return true;
  };

  const value: AuthContextType = {
    user,
    tenantId,
    features,
    globalAccess,
    isAuthenticated: !!user,
    login,
    logout,
    hasRole,
    hasAnyRole,
    hasFeature,
    checkAgentSubscription,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
