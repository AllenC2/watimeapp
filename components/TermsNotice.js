'use client';

import { TERMS_OF_SERVICE, TERMS_UPDATED } from '../lib/terms';

export default function TermsNotice({ language }) {
  const lang = language === 'en' ? 'en' : 'es';
  const sections = TERMS_OF_SERVICE[lang];
  const updated = TERMS_UPDATED[lang];

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
