import { useId, useState, type ReactNode } from 'react';

import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Tabs,
  TextField,
  Tooltip,
  type BadgeTone,
  type ToastTone,
} from '../components';
import { messages } from '../messages/es';

export interface SamplesPageProps {
  /** Publica un aviso en la región global de `App`. */
  readonly onNotify: (tone: ToastTone, message: string) => void;
}

const BADGE_TONES: ReadonlyArray<{
  readonly tone: BadgeTone;
  readonly label: string;
}> = [
  { tone: 'neutral', label: messages.samples.badges.neutral },
  { tone: 'accent', label: messages.samples.badges.accent },
  { tone: 'success', label: messages.samples.badges.success },
  { tone: 'warning', label: messages.samples.badges.warning },
  { tone: 'danger', label: messages.samples.badges.danger },
];

interface SectionProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/** Sección con encabezado de nivel 2 y, opcionalmente, una entradilla. */
function Section({ title, description, children }: SectionProps) {
  const titleId = useId();

  return (
    <section className="wc-page__section" aria-labelledby={titleId}>
      <h2 className="wc-page__section-title" id={titleId}>
        {title}
      </h2>
      {description ? (
        <p className="wc-page__section-lead">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Página de muestras de los componentes base.
 *
 * Sirve para revisar estados y contenido largo en los dos temas. Todos los
 * controles son reales y navegables con teclado; los textos vienen del
 * catálogo y describen un mundo ficticio plausible.
 */
export function SamplesPage({ onNotify }: SamplesPageProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="wc-page">
      <p className="wc-page__section-lead">{messages.samples.lead}</p>

      <Section
        title={messages.samples.buttons.title}
        description={messages.samples.buttons.lead}
      >
        <div className="wc-row">
          <Button variant="primary">{messages.samples.buttons.primary}</Button>
          <Button variant="secondary">
            {messages.samples.buttons.secondary}
          </Button>
          <Button variant="ghost">{messages.samples.buttons.ghost}</Button>
          <Button variant="danger">{messages.samples.buttons.danger}</Button>
          <Button variant="secondary" size="sm">
            {messages.samples.buttons.small}
          </Button>
          <Button loading>{messages.samples.buttons.loading}</Button>
          <Button disabled>{messages.samples.buttons.disabled}</Button>
        </div>
      </Section>

      <Section
        title={messages.samples.fields.title}
        description={messages.samples.fields.lead}
      >
        <div className="wc-samples__fields">
          <TextField
            label={messages.samples.fields.normalLabel}
            defaultValue={messages.samples.fields.normalValue}
          />
          <TextField
            label={messages.samples.fields.hintLabel}
            hint={messages.samples.fields.hint}
          />
          <TextField
            label={messages.samples.fields.errorLabel}
            defaultValue={messages.samples.fields.errorValue}
            error={messages.samples.fields.error}
          />
          <TextField
            label={messages.samples.fields.disabledLabel}
            defaultValue={messages.samples.fields.disabledValue}
            disabled
          />
          <TextField
            label={messages.samples.fields.readonlyLabel}
            defaultValue={messages.samples.fields.readonlyValue}
            readOnly
          />
          <TextField
            label={messages.samples.fields.requiredLabel}
            placeholder={messages.samples.fields.requiredPlaceholder}
            required
          />
        </div>
      </Section>

      <Section
        title={messages.samples.badges.title}
        description={messages.samples.badges.lead}
      >
        <div className="wc-row">
          {BADGE_TONES.map((badge) => (
            <Badge key={badge.tone} tone={badge.tone}>
              {badge.label}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title={messages.samples.card.sectionTitle}>
        <Card
          title={messages.samples.card.title}
          tone="accent"
          headingLevel={3}
        >
          <p>{messages.samples.card.body}</p>
          <div className="wc-row">
            <Badge tone="accent">{messages.samples.card.badge}</Badge>
          </div>
        </Card>
      </Section>

      <Section title={messages.samples.tabs.sectionTitle}>
        <Tabs
          label={messages.samples.tabs.label}
          items={[
            {
              id: 'resumen',
              label: messages.samples.tabs.summary.label,
              content: (
                <p className="wc-samples__text">
                  {messages.samples.tabs.summary.body}
                </p>
              ),
            },
            {
              id: 'relaciones',
              label: messages.samples.tabs.relations.label,
              content: (
                <p className="wc-samples__text">
                  {messages.samples.tabs.relations.body}
                </p>
              ),
            },
            {
              id: 'notas',
              label: messages.samples.tabs.notes.label,
              content: (
                <p className="wc-samples__text">
                  {messages.samples.tabs.notes.body}
                </p>
              ),
            },
          ]}
        />
      </Section>

      <Section title={messages.samples.dialog.sectionTitle}>
        <div className="wc-row">
          <Button
            variant="secondary"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            {messages.samples.dialog.open}
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
          }}
          title={messages.samples.dialog.title}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDialogOpen(false);
                }}
              >
                {messages.samples.dialog.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDialogOpen(false);
                  onNotify('success', messages.samples.dialog.confirmed);
                }}
              >
                {messages.samples.dialog.confirm}
              </Button>
            </>
          }
        >
          <p>{messages.samples.dialog.body}</p>
        </Dialog>
      </Section>

      <Section title={messages.samples.tooltip.sectionTitle}>
        <div className="wc-row">
          <Tooltip label={messages.samples.tooltip.label}>
            <Button variant="secondary">
              {messages.samples.tooltip.trigger}
            </Button>
          </Tooltip>
        </div>
      </Section>

      <Section
        title={messages.samples.toasts.title}
        description={messages.samples.toasts.lead}
      >
        <div className="wc-row">
          <Button
            variant="secondary"
            onClick={() => {
              onNotify('info', messages.samples.toasts.info);
            }}
          >
            {messages.samples.toasts.infoButton}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onNotify('success', messages.samples.toasts.success);
            }}
          >
            {messages.samples.toasts.successButton}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onNotify('error', messages.samples.toasts.error);
            }}
          >
            {messages.samples.toasts.errorButton}
          </Button>
        </div>
      </Section>

      <Section title={messages.samples.empty.sectionTitle}>
        <EmptyState
          headingLevel={3}
          title={messages.samples.empty.title}
          description={messages.samples.empty.description}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                onNotify('info', messages.samples.empty.actionMessage);
              }}
            >
              {messages.samples.empty.action}
            </Button>
          }
        />
      </Section>

      <Section
        title={messages.samples.longContent.title}
        description={messages.samples.longContent.lead}
      >
        <div className="wc-samples__long">
          <h3 className="wc-samples__long-title">
            {messages.samples.longContent.heading}
          </h3>
          <p>{messages.samples.longContent.paragraph}</p>
          <p className="wc-samples__long-name">
            {messages.samples.longContent.name}
          </p>
          <p className="wc-samples__path">
            {messages.samples.longContent.path}
          </p>
        </div>
      </Section>
    </div>
  );
}
