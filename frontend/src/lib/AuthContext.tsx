"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

import { useGoogleLogin } from '@react-oauth/google';

type User = {
  id: string;
  name: string;
  email: string;
  image?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (provider: 'google' | 'github') => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for session
    const storedUser = localStorage.getItem('mockUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }).then(res => res.json());

        const realUser: User = {
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          image: userInfo.picture,
        };
        setUser(realUser);
        localStorage.setItem('mockUser', JSON.stringify(realUser));
      } catch (err) {
        console.error("Google login failed", err);
      } finally {
        setLoading(false);
      }
    },
    onError: errorResponse => console.error(errorResponse),
  });

  const login = (provider: 'google' | 'github') => {
    if (provider === 'google') {
      googleLogin();
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mockUser');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
