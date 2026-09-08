'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import CalendarView from '../components/CalendarView';
import MessageForm from '../components/MessageForm';
import { usePreferences } from '../components/PreferencesProvider';

export default function Home() {
  const { t } = usePreferences();
  const [messages, setMessages] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/schedule');
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  const handleMessageScheduled = () => {
    setIsModalOpen(false);
    fetchMessages();
  };

  return (
    <div className="dashboard-container dashboard-container--agenda">
      <Sidebar />
      <main className="main-content main-content--agenda">
        <CalendarView messages={messages} onNewMessage={() => setIsModalOpen(true)} />
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-message-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="new-message-title">{t('message.title')}</h2>
              <button
                type="button"
                className="nav-btn"
                aria-label={t('common.close')}
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <MessageForm embedded onMessageScheduled={handleMessageScheduled} />
          </div>
        </div>
      )}
    </div>
  );
}
