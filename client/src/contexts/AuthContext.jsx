import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigReady } from '../services/supabaseClient.js';
import { deleteCurrentAccount, getCurrentUser, loginUser, logoutUser, registerUser, sendPasswordReset, signInWithGoogle, updatePassword } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [emailVerificationSuccess, setEmailVerificationSuccess] = useState(false);

  function getAuthFlow() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return searchParams.get('auth_flow') || hashParams.get('auth_flow') || hashParams.get('type') || searchParams.get('type');
  }

  function cleanAuthFlowUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('auth_flow');
    url.searchParams.delete('type');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        if (getAuthFlow() === 'email_verification' && supabaseConfigReady) {
          await supabase.auth.signOut().catch(() => {});
          cleanAuthFlowUrl();
          if (isMounted) {
            setEmailVerificationSuccess(true);
            setUser(null);
          }
          return;
        }

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

      if (event === 'SIGNED_IN' && getAuthFlow() === 'email_verification') {
        setEmailVerificationSuccess(true);
        setUser(null);
        setLoading(false);
        cleanAuthFlowUrl();
        supabase.auth.signOut().catch(() => {});
        return;
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

  function finishEmailVerification() {
    setEmailVerificationSuccess(false);
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
    emailVerificationSuccess,
    finishEmailVerification,
    finishPasswordRecovery,
    login,
    loginWithGoogle,
    passwordRecovery,
    register,
    logout,
    resetPassword,
    saveNewPassword
  }), [emailVerificationSuccess, loading, passwordRecovery, user]);

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
