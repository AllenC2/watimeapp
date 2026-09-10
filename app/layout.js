import AppProviders from '../components/AppProviders';
import { APP_ICON_SRC } from '../lib/preferences';
import "./globals.css";

export const metadata = {
  title: "WATime",
  description: "Dashboard para programar mensajes de WhatsApp",
  icons: {
    icon: [{ url: APP_ICON_SRC, type: "image/svg+xml" }],
    shortcut: APP_ICON_SRC,
    apple: APP_ICON_SRC,
  },
};

const THEME_BOOT = `(function(){try{var p=JSON.parse(localStorage.getItem('wp-panel-prefs')||'{}');var t=p.theme;var ok=t==='lima'||t==='light'||t==='dark'||t==='marino'||t==='bosque'||t==='petalo';document.documentElement.setAttribute('data-theme',ok?t:'lima');if(p.language==='en'||p.language==='es')document.documentElement.lang=p.language;}catch(e){document.documentElement.setAttribute('data-theme','lima');}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
