import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

import { GoogleOAuthProvider } from '@react-oauth/google';

function LocalizedGoogleOAuthProvider({ children }) {
  const { language } = useLanguage();
  const googleLocale = language === 'vi' ? 'vi' : 'en_US';

  return (
    <GoogleOAuthProvider
      key={googleLocale}
      clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
      locale={googleLocale}
      nonce={googleLocale}
    >
      {children}
    </GoogleOAuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <LocalizedGoogleOAuthProvider>
        <App />
      </LocalizedGoogleOAuthProvider>
    </LanguageProvider>
  </React.StrictMode>
);
