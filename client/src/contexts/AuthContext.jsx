import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigReady } from '../services/supabaseClient.js';
import { deleteCurrentAccount, getCurrentUser, loginUser, logoutUser, registerUser, sendPasswordReset, signInWithGoogle, updatePassword } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

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
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }

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

  async function saveNewPassword(password) {
    const data = await updatePassword(password);
    setPasswordRecovery(false);
    return data;
  }

  function finishPasswordRecovery() {
    setPasswordRecovery(false);
  }

  async function loginWithGoogle() {
    return signInWithGoogle();
  }

  async function deleteAccount() {
    const data = await deleteCurrentAccount();
    setUser(null);
    return data;
  }

  const value = useMemo(() => ({
    user,
    loading,
    deleteAccount,
    finishPasswordRecovery,
    login,
    loginWithGoogle,
    passwordRecovery,
    register,
    logout,
    resetPassword,
    saveNewPassword
  }), [loading, passwordRecovery, user]);

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
