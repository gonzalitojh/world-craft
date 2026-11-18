import { useId } from 'react';

import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';
import { messages } from '../messages/es';

export interface HomePageProps {
  /** Acción de «Crear mundo»; de momento anuncia que llegará más adelante. */
  readonly onCreateWorld: () => void;
}

/**
 * Inicio: estado vacío real del primer arranque.
 *
 * Explica qué es un mundo, qué se podrá hacer y qué pasa con los datos. La
 * acción principal es honesta: abre un aviso, no un formulario que todavía no
 * existe.
 */
export function HomePage({ onCreateWorld }: HomePageProps) {
  const sectionTitleId = useId();

  return (
    <div className="wc-page">
      <EmptyState
        title={messages.home.emptyTitle}
        description={messages.home.emptyDescription}
        action={
          <Button variant="primary" onClick={onCreateWorld}>
            {messages.home.emptyAction}
          </Button>
        }
      />

      <section className="wc-page__section" aria-labelledby={sectionTitleId}>
        <h2 className="wc-page__section-title" id={sectionTitleId}>
          {messages.home.nextStepsTitle}
        </h2>
        <ul className="wc-home__list">
          {messages.home.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <p className="wc-page__note">{messages.home.note}</p>
      </section>
    </div>
  );
}
