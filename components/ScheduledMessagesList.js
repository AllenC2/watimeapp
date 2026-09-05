'use client';

import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { formatScheduledDateTime } from '../lib/schedule-time';

export default function ScheduledMessagesList({ messages }) {
  if (!messages || messages.length === 0) {
    return (
      <div className="glass-panel" style={{ marginTop: '2rem' }}>
        <p className="placeholder">No hay mensajes programados.</p>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <CheckCircle2 size={20} color="#25D366" />;
      case 'failed': return <XCircle size={20} color="#EF4444" />;
      default: return <Clock size={20} color="#F59E0B" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'failed': return 'Error';
      default: return 'Pendiente';
    }
  };

  return (
    <div className="glass-panel" style={{ marginTop: '2rem' }}>
      <h2>Mensajes Programados</h2>
      <div className="table-container">
        <table className="messages-table">
          <thead>
            <tr>
              <th>Destinatario</th>
              <th>Contenido</th>
              <th>Programado Para</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg) => (
              <tr key={msg.id}>
                <td>{msg.recipient}</td>
                <td className="msg-content">
                  <div className="msg-content-cell">
                    {msg.image_url && (
                      <img src={msg.image_url} alt="" className="msg-thumb" />
                    )}
                    <span>{msg.content || 'Imagen adjunta'}</span>
                  </div>
                </td>
                <td>{formatScheduledDateTime(msg.scheduled_for)}</td>
                <td>
                  <div className="status-badge" data-status={msg.status}>
                    {getStatusIcon(msg.status)}
                    <span>{getStatusText(msg.status)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
