import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigReady } from '../services/supabaseClient.js';
import { getCurrentUser, loginUser, logoutUser, registerUser, sendPasswordReset } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    if (!supabaseConfigReady) {
      return () => {
        isMounted = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function login(email, password) {
    const data = await loginUser(email, password);
    setUser(data.session?.user || data.user || null);
    return data;
  }

  async function register(email, password) {
    const data = await registerUser(email, password);
    setUser(data.session?.user || null);
    return data;
  }

  async function logout() {
    await logoutUser();
    setUser(null);
  }

  async function resetPassword(email) {
    return sendPasswordReset(email);
  }

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    logout,
    resetPassword
  }), [loading, user]);

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
