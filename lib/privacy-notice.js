export const APP_VERSION = '1.4';
export const APP_NAME = 'WATime';
export const APP_SITE = 'https://watime.click';

export const PRIVACY_NOTICE_UPDATED = {
  es: '9 de septiembre de 2026',
  en: 'September 9, 2026',
};

export const PRIVACY_NOTICE = {
  es: [
    {
      title: '1. Responsable',
      paragraphs: [
        'El responsable del tratamiento es Allen Yair Contreras Luna, RFC COLA0103301D1, quien opera WATime (watime.click) como persona física. No hay sociedad mercantil. Para ejercer derechos o dudas de privacidad, escribe a privacy@watime.click.',
      ],
    },
    {
      title: '2. Qué es el servicio',
      paragraphs: [
        'WATime permite programar y enviar mensajes de WhatsApp a números, grupos o canales desde una cuenta que el usuario vincula con un código QR. El Servicio es gratuito. No es un producto oficial de Meta ni de WhatsApp.',
      ],
    },
    {
      title: '3. Datos que recabamos',
      paragraphs: [
        'Cuenta: usuario, correo, contraseña almacenada como hash, códigos temporales de verificación y cookie de sesión (wp_session, 7 días, HttpOnly).',
        'Preferencias: idioma, tema, logo, zona horaria, formato de hora y vista de la agenda. En el navegador solo se recuerdan tema e idioma.',
        'Uso: contactos (nombre e identificador), plantillas, mensajes programados o enviados (destinatario, texto, fecha, estado e imagen) y, al enviar, teléfono y nombre de la cuenta de WhatsApp usada.',
        'WhatsApp: archivos de sesión por usuario, número, nombre visible, plataforma e IDs de canales de los que es propietario o administrador. Al cerrar WhatsApp en el panel se busca borrar esa sesión del servidor.',
      ],
    },
    {
      title: '4. Finalidades',
      paragraphs: [
        'Crear y autenticar la cuenta, aplicar preferencias, guardar contactos y plantillas, programar envíos, conectar WhatsApp y mostrar historial. También permitir borrar mensajes, contactos o datos locales, y exportar contactos en CSV.',
        'La zona horaria se toma del navegador en el primer uso. El idioma lo elige el usuario (inglés por defecto en el primer acceso). No vendemos datos ni hacemos publicidad con ellos.',
      ],
    },
    {
      title: '5. Encargados y terceros',
      paragraphs: [
        'Resend envía los correos de verificación (destinatario y código). Al conectar y enviar, el contenido e identificadores de chat circulan por los sistemas de WhatsApp/Meta, según sus propias políticas. Proveedores de hospedaje del sitio pueden tratar datos solo para operar el servicio.',
      ],
    },
    {
      title: '6. Conservación y bajas',
      paragraphs: [
        'Los datos se conservan mientras la cuenta esté activa. En Preferencias → Privacidad puedes borrar datos del navegador, mensajes e imágenes, o contactos. Para eliminar la cuenta por completo, escribe a privacy@watime.click.',
      ],
    },
    {
      title: '7. Derechos ARCO',
      paragraphs: [
        'Puedes solicitar acceso, rectificación, cancelación u oposición, o revocar el consentimiento, enviando un correo a privacy@watime.click con tu identidad y la petición. Parte de los datos también se corrige en el propio panel.',
      ],
    },
    {
      title: '8. Cookies',
      paragraphs: [
        'La cookie esencial wp_session mantiene la sesión. Sin ella no puedes usar el panel autenticado. No usamos cookies de publicidad.',
      ],
    },
    {
      title: '9. Cambios',
      paragraphs: [
        'Las actualizaciones de este aviso se publicarán en el Servicio con nueva fecha.',
      ],
    },
  ],
  en: [
    {
      title: '1. Controller',
      paragraphs: [
        'The controller is Allen Yair Contreras Luna, RFC COLA0103301D1, who operates WATime (watime.click) as an individual. There is no company. For privacy rights or questions, write to privacy@watime.click.',
      ],
    },
    {
      title: '2. What the service is',
      paragraphs: [
        'WATime lets you schedule and send WhatsApp messages to numbers, groups, or channels from an account you link with a QR code. The Service is free. It is not an official Meta or WhatsApp product.',
      ],
    },
    {
      title: '3. Data we collect',
      paragraphs: [
        'Account: username, email, password stored as a hash, temporary verification codes, and a session cookie (wp_session, 7 days, HttpOnly).',
        'Preferences: language, theme, logo, timezone, hour format, and calendar view. The browser only stores theme and language.',
        'Use: contacts (name and identifier), templates, scheduled or sent messages (recipient, text, date, status, and image) and, when sending, the phone and name of the WhatsApp account used.',
        'WhatsApp: per-user session files, number, display name, platform, and IDs of channels you own or administer. Logging out of WhatsApp in the panel aims to delete that session from the server.',
      ],
    },
    {
      title: '4. Purposes',
      paragraphs: [
        'Creating and authenticating the account, applying preferences, storing contacts and templates, scheduling sends, connecting WhatsApp, and showing history. Also letting you delete messages, contacts, or local preference data, and export contacts as CSV.',
        'Timezone comes from the browser on first use. Language is chosen by the user (English by default at first login). We do not sell data or use it for advertising.',
      ],
    },
    {
      title: '5. Processors and third parties',
      paragraphs: [
        'Resend sends verification emails (recipient and code). When you connect and send, content and chat IDs go through WhatsApp/Meta systems under their own policies. Hosting providers may process data only to operate the service.',
      ],
    },
    {
      title: '6. Retention',
      paragraphs: [
        'Data is kept while the account is active. In Preferences → Privacy you can clear browser data, messages and images, or contacts. To delete the entire account, write to privacy@watime.click.',
      ],
    },
    {
      title: '7. Access and other rights',
      paragraphs: [
        'You may request access, correction, deletion, or objection, or withdraw consent, by emailing privacy@watime.click with your identity and request. Some data can also be updated in the panel.',
      ],
    },
    {
      title: '8. Cookies',
      paragraphs: [
        'The essential wp_session cookie keeps you signed in. Without it you cannot use the authenticated panel. We do not use advertising cookies.',
      ],
    },
    {
      title: '9. Changes',
      paragraphs: [
        'Updates to this notice will be published in the Service with a new date.',
      ],
    },
  ],
};
