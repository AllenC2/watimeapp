export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  try {
    const { dbReady } = await import('./lib/db.js');
    await dbReady;
    const { restoreWhatsAppSessions } = await import('./lib/whatsapp.js');
    restoreWhatsAppSessions().catch((err) => {
      console.error('[WhatsApp] Error restaurando sesiones:', err.message || err);
    });
  } catch (err) {
    console.error('[WhatsApp] No se pudo iniciar la restauración:', err.message || err);
  }
}
