import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const supportedLanguages = [
  { code: 'en', label: 'English' },
  { code: 'id', label: 'Indonesia' }
];

const storageKey = 'dompetdaily_language';
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => (
    localStorage.getItem(storageKey) || 'en'
  ));

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(storageKey, language);
  }, [language]);

  function setLanguage(nextLanguage) {
    const isSupported = supportedLanguages.some((option) => option.code === nextLanguage);
    setLanguageState(isSupported ? nextLanguage : 'en');
  }

  const value = useMemo(() => ({
    language,
    setLanguage,
    supportedLanguages
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}
