'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Clock, Calendar, ImagePlus, X } from 'lucide-react';
import { fromDateAndTime } from '../lib/schedule-time';

export default function MessageForm({ onMessageScheduled, embedded = false }) {
  const [recipient, setRecipient] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('');
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const clearImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen');
      clearImage();
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('La imagen no puede superar 8 MB');
      clearImage();
      return;
    }

    setImageFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recipient || !date || !time) return;
    if (!content && !imageFile) {
      alert('Escribe un mensaje o adjunta una imagen');
      return;
    }

    setLoading(true);

    const scheduled_for = fromDateAndTime(date, time);
    const formData = new FormData();
    formData.append('recipient', recipient);
    formData.append('content', content);
    formData.append('scheduled_for', scheduled_for);
    if (imageFile) formData.append('image', imageFile);

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setRecipient('');
        setContent('');
        setDate('');
        setTime('');
        clearImage();
        onMessageScheduled?.();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Error al programar el mensaje');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const form = (
    <form onSubmit={handleSubmit} className="message-form">
      <div className="form-group">
        <label htmlFor="recipient">Destinatario (Número o ID del Grupo)</label>
        <input
          type="text"
          id="recipient"
          placeholder="Ej. 1234567890 o 123456@g.us"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="content">Contenido del Mensaje</label>
        <textarea
          id="content"
          rows="4"
          placeholder="Escribe el mensaje para tu canal..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        ></textarea>
      </div>

      <div className="form-group">
        <label htmlFor="image">Imagen adjunta</label>
        <input
          ref={fileInputRef}
          type="file"
          id="image"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImageChange}
          className="image-input"
        />

        {imagePreview ? (
          <div className="image-preview">
            <img src={imagePreview} alt="Vista previa de la imagen adjunta" />
            <button type="button" className="image-preview-remove" onClick={clearImage} aria-label="Quitar imagen">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="image-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={20} />
            <span>Adjuntar imagen</span>
            <small>JPG, PNG, WEBP o GIF · máx. 8 MB</small>
          </button>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="date"><Calendar size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Fecha</label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="time"><Clock size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Hora</label>
          <input
            type="time"
            id="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Programando...' : (
          <>
            <Send size={18} /> Programar Mensaje
          </>
        )}
      </button>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <div className="glass-panel">
      <h2>Nuevo Mensaje</h2>
      {form}
    </div>
  );
}
