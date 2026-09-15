import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('portal-token'));
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('portal-user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('portal-token', token);
    } else {
      localStorage.removeItem('portal-token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('portal-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('portal-user');
    }
  }, [user]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({
    token,
    user,
    isAuthenticated: Boolean(token && user),
    API_BASE_URL,
    login,
    logout,
  }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
