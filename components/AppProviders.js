'use client';

import { PreferencesProvider } from './PreferencesProvider';
import { TourProvider } from './TourProvider';
import { WhatsAppStatusProvider } from './WhatsAppStatusProvider';
import WelcomeModal from './WelcomeModal';

export default function AppProviders({ children }) {
  return (
    <PreferencesProvider>
      <WhatsAppStatusProvider>
        <TourProvider>
          {children}
          <WelcomeModal />
        </TourProvider>
      </WhatsAppStatusProvider>
    </PreferencesProvider>
  );
}
