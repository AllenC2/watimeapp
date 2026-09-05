'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import MessageForm from '../../components/MessageForm';
import ScheduledMessagesList from '../../components/ScheduledMessagesList';

export default function Programar() {
  const [messages, setMessages] = useState([]);

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

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header>
          <h1>Programar Mensajes</h1>
          <p>Crea y agenda mensajes para tu canal de WhatsApp.</p>
        </header>
        <section>
          <MessageForm onMessageScheduled={fetchMessages} />
          <ScheduledMessagesList messages={messages} />
        </section>
      </main>
    </div>
  );
}
