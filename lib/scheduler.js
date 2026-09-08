/** @deprecated El cron ya no marca mensajes como enviados. El envío es por usuario en lib/whatsapp.js */
import { runQuery, getQuery } from './db';

export async function processScheduledMessages() {
  console.log(`[Scheduler] Checking for messages to send at ${new Date().toISOString()}...`);
  
  try {
    // Buscar mensajes pendientes cuya fecha programada sea <= a la fecha actual
    // usando la zona horaria UTC o local. Para simplificar, comparamos con ISO string.
    const now = new Date().toISOString();
    
    const messages = await getQuery(
      `SELECT * FROM scheduled_messages WHERE status = 'pending' AND scheduled_for <= ?`,
      [now]
    );

    if (messages.length === 0) {
      console.log('[Scheduler] No pending messages to send.');
      return 0;
    }

    console.log(`[Scheduler] Found ${messages.length} message(s) to send.`);

    for (const msg of messages) {
      console.log(`[Scheduler] Sending message ID ${msg.id}...`);
      
      // Aquí es donde haríamos la llamada a la API de WhatsApp
      // await sendWhatsAppMessage(msg.content);
      
      // Simulamos un retraso de red de 1 segundo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Actualizamos el estado a 'sent'
      await runQuery(`UPDATE scheduled_messages SET status = 'sent' WHERE id = ?`, [msg.id]);
      console.log(`[Scheduler] Message ID ${msg.id} sent successfully.`);
    }
    
    return messages.length;
  } catch (error) {
    console.error('[Scheduler] Error processing messages:', error);
    throw error;
  }
}
