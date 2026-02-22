import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './query-client';
import { fetch } from 'expo/fetch';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  getDebugInfo: () => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem('auth_token', token);
  } else {
    await SecureStore.setItemAsync('auth_token', token);
  }
}

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem('auth_token');
  } else {
    return SecureStore.getItemAsync('auth_token');
  }
}

async function removeToken() {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem('auth_token');
  } else {
    await SecureStore.deleteItemAsync('auth_token');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  function getDebugInfo(): string {
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN || '(not set)';
      let apiUrl = '(error getting URL)';
      try { apiUrl = getApiUrl(); } catch (e: any) { apiUrl = `Error: ${e.message}`; }
      return `Platform: ${Platform.OS} | Domain: ${domain} | API: ${apiUrl}`;
    } catch (e: any) {
      return `Debug error: ${e.message}`;
    }
  }

  async function loadStoredAuth() {
    try {
      const storedToken = await getToken();
      if (storedToken) {
        const baseUrl = getApiUrl();
        const res = await fetch(`${baseUrl}api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          setToken(storedToken);
        } else {
          await removeToken();
        }
      }
    } catch (err) {
      console.error('Auth load error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      let baseUrl: string;
      try {
        baseUrl = getApiUrl();
      } catch (urlErr: any) {
        console.error('Login URL error:', urlErr);
        return { success: false, error: `API URL error: ${urlErr.message}. EXPO_PUBLIC_DOMAIN=${process.env.EXPO_PUBLIC_DOMAIN || '(not set)'}` };
      }

      const loginUrl = `${baseUrl}api/auth/login`;
      console.log('Login attempt to:', loginUrl);

      let res: Response;
      try {
        res = await fetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      } catch (fetchErr: any) {
        console.error('Login fetch error:', fetchErr);
        return { success: false, error: `Network error: ${fetchErr.message}. URL: ${loginUrl}` };
      }

      let data: any;
      try {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          return { success: false, error: `Server returned non-JSON (status ${res.status}): ${text.substring(0, 200)}` };
        }
      } catch (parseErr: any) {
        return { success: false, error: `Response parse error (status ${res.status}): ${parseErr.message}` };
      }

      if (!res.ok) {
        return { success: false, error: data.message || `Login failed (status ${res.status})` };
      }

      if (!data.token) {
        return { success: false, error: 'Server response missing token' };
      }

      await saveToken(data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      console.error('Login unexpected error:', err);
      return { success: false, error: `Unexpected error: ${err.message}` };
    }
  }

  async function register(email: string, password: string) {
    try {
      let baseUrl: string;
      try {
        baseUrl = getApiUrl();
      } catch (urlErr: any) {
        return { success: false, error: `API URL error: ${urlErr.message}. EXPO_PUBLIC_DOMAIN=${process.env.EXPO_PUBLIC_DOMAIN || '(not set)'}` };
      }

      const registerUrl = `${baseUrl}api/auth/register`;
      console.log('Register attempt to:', registerUrl);

      let res: Response;
      try {
        res = await fetch(registerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      } catch (fetchErr: any) {
        return { success: false, error: `Network error: ${fetchErr.message}. URL: ${registerUrl}` };
      }

      let data: any;
      try {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          return { success: false, error: `Server returned non-JSON (status ${res.status}): ${text.substring(0, 200)}` };
        }
      } catch (parseErr: any) {
        return { success: false, error: `Response parse error (status ${res.status}): ${parseErr.message}` };
      }

      if (!res.ok) {
        return { success: false, error: data.message || `Registration failed (status ${res.status})` };
      }

      if (!data.token) {
        return { success: false, error: 'Server response missing token' };
      }

      await saveToken(data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Unexpected error: ${err.message}` };
    }
  }

  async function logout() {
    await removeToken();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({
    user, token, isLoading, login, register, logout, getDebugInfo,
  }), [user, token, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
