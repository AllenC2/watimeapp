'use client';

import { PRIVACY_NOTICE, PRIVACY_NOTICE_UPDATED } from '../lib/privacy-notice';

export default function PrivacyNotice({ language }) {
  const lang = language === 'en' ? 'en' : 'es';
  const sections = PRIVACY_NOTICE[lang];
  const updated = PRIVACY_NOTICE_UPDATED[lang];

  return (
    <article className="prefs-aviso">
      <p className="prefs-aviso-updated">
        {lang === 'en' ? `Last updated: ${updated}` : `Última actualización: ${updated}`}
      </p>
      {sections.map((section) => (
        <section key={section.title}>
          <h4>{section.title}</h4>
          {section.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
