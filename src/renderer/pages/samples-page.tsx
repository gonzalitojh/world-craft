import { useId, useState, type ReactNode } from 'react';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  IconButton,
  Menu,
  Panel,
  Radio,
  RadioGroup,
  SelectField,
  Skeleton,
  SkeletonText,
  Tabs,
  TextAreaField,
  TextField,
  Tooltip,
  type BadgeTone,
  type ToastTone,
} from '../components';
import { useMessages } from '../i18n/provider';

export interface SamplesPageProps {
  /** Publica un aviso en la región global de `App`. */
  readonly onNotify: (tone: ToastTone, message: string) => void;
}

/** Valores técnicos de los controles de muestra; no son texto visible. */
const FIELD_VALUES = {
  active: 'active',
  draft: 'draft',
  archived: 'archived',
  epic: 'epic',
  intimate: 'intimate',
  documentary: 'documentary',
} as const;

interface SectionProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/** Sección con encabezado de nivel 2 y, opcionalmente, una entradilla. */
function Section({ title, description, children }: SectionProps) {
  const titleId = useId();

  return (
    <div className="wc-page__section">
      <h2
        className="wc-page__section-title wc-samples__section-title"
        id={titleId}
      >
        {title}
      </h2>
      {description ? (
        <p className="wc-page__section-lead">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <path d="M4 16l1-4 8.5-8.5a1.8 1.8 0 012.5 2.5L7.5 14.5 4 16z" />
      <path d="M11.5 5.5l3 3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
      <path d="M9 9v4M11 9v4" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <path d="M10 3l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.2l5-.7L10 3z" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M12.8 7.2l-1.6 4.4-4.4 1.6 1.6-4.4 4.4-1.6z" />
    </svg>
  );
}

/**
 * Banco interno del sistema de diseño v2.
 *
 * Reúne paleta, tipografía, primitivas y estados para revisar Claro y Oscuro,
 * la ventana a 1024/1280/1600 px y el comportamiento con contenido largo. No
 * es navegación de producto: sigue montado en el rail hasta #126.
 */
export function SamplesPage({ onNotify }: SamplesPageProps) {
  const messages = useMessages();
  const badgeTones: ReadonlyArray<{
    readonly tone: BadgeTone;
    readonly label: string;
  }> = [
    { tone: 'neutral', label: messages.samples.badges.neutral },
    { tone: 'accent', label: messages.samples.badges.accent },
    { tone: 'success', label: messages.samples.badges.success },
    { tone: 'warning', label: messages.samples.badges.warning },
    { tone: 'danger', label: messages.samples.badges.danger },
  ];
  const surfaces = [
    { id: 'bg', label: messages.samples.palette.surfaces.bg },
    { id: 'surface', label: messages.samples.palette.surfaces.surface },
    { id: 'raised', label: messages.samples.palette.surfaces.raised },
    { id: 'sunken', label: messages.samples.palette.surfaces.sunken },
  ] as const;
  const accents = [
    { id: 'accent', label: messages.samples.palette.accents.accent },
    {
      id: 'accent-surface',
      label: messages.samples.palette.accents.accentSurface,
    },
    { id: 'focus', label: messages.samples.palette.accents.focus },
    { id: 'selection', label: messages.samples.palette.accents.selection },
  ] as const;
  const states = [
    { id: 'success', label: messages.samples.palette.states.success },
    { id: 'warning', label: messages.samples.palette.states.warning },
    { id: 'danger', label: messages.samples.palette.states.danger },
  ] as const;
  const typeMarks = [
    { id: 'moss', label: messages.samples.typeMarks.moss },
    { id: 'ochre', label: messages.samples.typeMarks.ochre },
    { id: 'danger', label: messages.samples.typeMarks.danger },
    { id: 'prussian', label: messages.samples.typeMarks.prussian },
  ] as const;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [favorite, setFavorite] = useState(true);

  return (
    <div className="wc-page">
      <p className="wc-page__section-lead">{messages.samples.lead}</p>

      <Section
        title={messages.samples.palette.title}
        description={messages.samples.palette.lead}
      >
        <h3 className="wc-samples__long-name">
          {messages.samples.palette.surfacesTitle}
        </h3>
        <div className="wc-samples__grid">
          {surfaces.map((surface) => (
            <div className="wc-swatch" key={surface.id}>
              <span
                className={`wc-swatch__chip wc-swatch__chip--${surface.id}`}
                aria-hidden="true"
              />
              <span className="wc-swatch__name">{surface.label}</span>
            </div>
          ))}
        </div>
        <h3 className="wc-samples__long-name">
          {messages.samples.palette.accentsTitle}
        </h3>
        <div className="wc-samples__grid">
          {accents.map((accent) => (
            <div className="wc-swatch" key={accent.id}>
              <span
                className={`wc-swatch__chip wc-swatch__chip--${accent.id}`}
                aria-hidden="true"
              />
              <span className="wc-swatch__name">{accent.label}</span>
            </div>
          ))}
        </div>
        <h3 className="wc-samples__long-name">
          {messages.samples.palette.statesTitle}
        </h3>
        <div className="wc-samples__grid">
          {states.map((state) => (
            <div className="wc-swatch" key={state.id}>
              <span
                className={`wc-swatch__chip wc-swatch__chip--${state.id}`}
                aria-hidden="true"
              />
              <span className="wc-swatch__name">{state.label}</span>
            </div>
          ))}
        </div>
        <p className="wc-samples__text">
          {messages.samples.palette.contrastNote}
        </p>
      </Section>

      <Section
        title={messages.samples.typography.title}
        description={messages.samples.typography.lead}
      >
        <div className="wc-samples__long">
          <h3 className="wc-samples__long-name">
            {messages.samples.typography.uiTitle}
          </h3>
          <p className="wc-samples__type-ui">
            {messages.samples.typography.uiBody}
          </p>
          <h3 className="wc-samples__long-name">
            {messages.samples.typography.contentTitle}
          </h3>
          <p className="wc-samples__reading">
            {messages.samples.typography.contentBody}
          </p>
          <h3 className="wc-samples__long-name">
            {messages.samples.typography.contentStrongTitle}
          </h3>
          <p className="wc-samples__type-content-strong">
            {messages.samples.typography.contentStrong}
          </p>
          <h3 className="wc-samples__long-name">
            {messages.samples.typography.displayTitle}
          </h3>
          <p className="wc-samples__type-display">
            {messages.samples.typography.displayText}
          </p>
          <h3 className="wc-samples__long-name">
            {messages.samples.typography.monoTitle}
          </h3>
          <p className="wc-samples__type-mono">
            {messages.samples.typography.monoValue}
          </p>
          <h3 className="wc-samples__long-name">
            {messages.samples.typography.charsTitle}
          </h3>
          <p className="wc-samples__chars">
            {messages.samples.typography.chars}
          </p>
        </div>
      </Section>

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
        title={messages.samples.iconButtons.title}
        description={messages.samples.iconButtons.lead}
      >
        <div className="wc-row">
          <IconButton
            label={messages.samples.iconButtons.edit}
            tooltip={messages.samples.iconButtons.editTooltip}
            icon={<EditIcon />}
          />
          <IconButton
            label={messages.samples.iconButtons.delete}
            variant="danger"
            icon={<TrashIcon />}
          />
          <IconButton
            label={
              favorite
                ? messages.samples.iconButtons.favoriteOn
                : messages.samples.iconButtons.favorite
            }
            pressed={favorite}
            icon={<StarIcon />}
            onClick={() => {
              setFavorite((current) => !current);
            }}
          />
          <IconButton
            label={messages.samples.iconButtons.more}
            variant="secondary"
            icon={<CompassIcon />}
          />
          <IconButton
            label={messages.samples.iconButtons.loading}
            loading
            icon={<EditIcon />}
          />
        </div>
      </Section>

      <Section
        title={messages.samples.menu.sectionTitle}
        description={messages.samples.menu.lead}
      >
        <div className="wc-row">
          <Menu
            label={messages.samples.menu.trigger}
            items={[
              {
                id: 'edit',
                label: messages.samples.menu.edit,
                onSelect: () => {
                  onNotify('info', messages.samples.menu.editNotice);
                },
              },
              {
                id: 'duplicate',
                label: messages.samples.menu.duplicate,
                onSelect: () => {
                  onNotify('info', messages.samples.menu.duplicateNotice);
                },
              },
              {
                id: 'archive',
                label: messages.samples.menu.archive,
                disabled: true,
                onSelect: () => {
                  onNotify('info', messages.samples.menu.archiveNotice);
                },
              },
              {
                id: 'delete',
                label: messages.samples.menu.delete,
                tone: 'danger',
                onSelect: () => {
                  onNotify('info', messages.samples.menu.deleteNotice);
                },
              },
            ]}
          />
        </div>
        <div className="wc-row wc-samples__edge wc-samples__edge--menu">
          <Menu
            label={messages.samples.menu.edgeLabel}
            align="end"
            items={[
              {
                id: 'edit',
                label: messages.samples.menu.edit,
                onSelect: () => {
                  onNotify('info', messages.samples.menu.editNotice);
                },
              },
              {
                id: 'delete',
                label: messages.samples.menu.delete,
                tone: 'danger',
                onSelect: () => {
                  onNotify('info', messages.samples.menu.deleteNotice);
                },
              },
            ]}
          />
        </div>
        <div className="wc-row wc-samples__edge--long">
          <Menu
            label={messages.samples.menu.longLabel}
            items={Array.from({ length: 24 }, (_, index) => ({
              id: `long-${index}`,
              label: messages.samples.menu.longAction(index + 1),
              onSelect: () => {
                onNotify('info', messages.samples.menu.editNotice);
              },
            }))}
          />
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
          <TextAreaField
            label={messages.samples.fields.areaLabel}
            defaultValue={messages.samples.fields.areaValue}
            rows={4}
          />
          <SelectField
            label={messages.samples.fields.selectLabel}
            defaultValue={FIELD_VALUES.active}
            options={[
              {
                value: FIELD_VALUES.active,
                label: messages.samples.fields.selectActive,
              },
              {
                value: FIELD_VALUES.draft,
                label: messages.samples.fields.selectDraft,
              },
              {
                value: FIELD_VALUES.archived,
                label: messages.samples.fields.selectArchived,
              },
            ]}
          />
          <Checkbox
            label={messages.samples.fields.checkboxLabel}
            hint={messages.samples.fields.checkboxHint}
            defaultChecked
          />
          <Checkbox
            label={messages.samples.fields.checkboxErrorLabel}
            error={messages.samples.fields.checkboxError}
          />
          <RadioGroup
            legend={messages.samples.fields.radioLegend}
            hint={messages.samples.fields.radioHint}
          >
            <Radio
              label={messages.samples.fields.radioOne}
              value={FIELD_VALUES.epic}
              defaultChecked
            />
            <Radio
              label={messages.samples.fields.radioTwo}
              value={FIELD_VALUES.intimate}
            />
            <Radio
              label={messages.samples.fields.radioThree}
              value={FIELD_VALUES.documentary}
            />
          </RadioGroup>
          <RadioGroup
            legend={messages.samples.fields.radioLegend}
            error={messages.samples.fields.radioError}
          >
            <Radio
              label={messages.samples.fields.radioOne}
              value={FIELD_VALUES.epic}
            />
            <Radio
              label={messages.samples.fields.radioTwo}
              value={FIELD_VALUES.intimate}
            />
          </RadioGroup>
        </div>
      </Section>

      <Section
        title={messages.samples.badges.title}
        description={messages.samples.badges.lead}
      >
        <div className="wc-row">
          {badgeTones.map((badge) => (
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
          actions={
            <Menu
              label={messages.samples.card.menuLabel}
              align="end"
              items={[
                {
                  id: 'edit',
                  label: messages.samples.menu.edit,
                  onSelect: () => {
                    onNotify('info', messages.samples.card.editNotice);
                  },
                },
                {
                  id: 'duplicate',
                  label: messages.samples.menu.duplicate,
                  onSelect: () => {
                    onNotify('info', messages.samples.card.duplicateNotice);
                  },
                },
                {
                  id: 'delete',
                  label: messages.samples.menu.delete,
                  tone: 'danger',
                  onSelect: () => {
                    onNotify('info', messages.samples.card.deleteNotice);
                  },
                },
              ]}
            />
          }
        >
          <p>{messages.samples.card.body}</p>
          <div className="wc-row">
            <Badge tone="accent">{messages.samples.card.badge}</Badge>
          </div>
        </Card>
        <Card title={messages.samples.card.plainTitle} headingLevel={3}>
          <p>{messages.samples.card.plainBody}</p>
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
          <div className="wc-row">
            <IconButton
              label={messages.samples.dialog.iconLabel}
              tooltip={messages.samples.dialog.iconTooltip}
              variant="secondary"
              icon={<CompassIcon />}
            />
            <Menu
              label={messages.samples.dialog.menuLabel}
              items={[
                {
                  id: 'edit',
                  label: messages.samples.menu.edit,
                  onSelect: () => {
                    onNotify('info', messages.samples.menu.editNotice);
                  },
                },
                {
                  id: 'delete',
                  label: messages.samples.menu.delete,
                  tone: 'danger',
                  onSelect: () => {
                    onNotify('info', messages.samples.menu.deleteNotice);
                  },
                },
              ]}
            />
          </div>
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
        <div className="wc-row wc-samples__edge wc-samples__edge--tooltip">
          <Tooltip label={messages.samples.iconButtons.editTooltip}>
            <IconButton
              label={messages.samples.iconButtons.edit}
              variant="secondary"
              icon={<EditIcon />}
            />
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

      <Section
        title={messages.samples.panel.title}
        description={messages.samples.panel.lead}
      >
        <Panel
          title={messages.samples.panel.panelTitle}
          description={messages.samples.panel.panelDescription}
          headingLevel={3}
          actions={
            <Menu
              label={messages.samples.panel.panelMenuLabel}
              align="end"
              items={[
                {
                  id: 'edit',
                  label: messages.samples.menu.edit,
                  onSelect: () => {
                    onNotify('info', messages.samples.panel.editNotice);
                  },
                },
                {
                  id: 'delete',
                  label: messages.samples.menu.delete,
                  tone: 'danger',
                  onSelect: () => {
                    onNotify('info', messages.samples.panel.deleteNotice);
                  },
                },
              ]}
            />
          }
          footer={
            <Button variant="secondary">{messages.samples.panel.save}</Button>
          }
        >
          <p className="wc-samples__text">{messages.samples.panel.panelBody}</p>
          <p className="wc-page__note">{messages.samples.panel.panelFooter}</p>
        </Panel>
      </Section>

      <Section
        title={messages.samples.skeleton.title}
        description={messages.samples.skeleton.lead}
      >
        <div className="wc-samples__grid" aria-busy="true">
          <div className="wc-samples__long">
            <h3 className="wc-samples__long-name">
              {messages.samples.skeleton.cardTitle}
            </h3>
            <Skeleton variant="circle" />
            <SkeletonText lines={4} />
            <Skeleton variant="block" height="4rem" />
          </div>
          <p className="wc-visually-hidden" role="status">
            {messages.samples.skeleton.loading}
          </p>
        </div>
      </Section>

      <Section title={messages.samples.empty.sectionTitle}>
        <EmptyState
          headingLevel={3}
          icon={<CompassIcon />}
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
        title={messages.samples.typeMarks.title}
        description={messages.samples.typeMarks.lead}
      >
        <div className="wc-samples__types">
          {typeMarks.map((mark) => (
            <span className="wc-type-mark-group" key={mark.id}>
              <span
                className={`wc-type-mark wc-type-color--${mark.id}`}
                aria-hidden="true"
              />
              <span className="wc-type-mark-label">{mark.label}</span>
            </span>
          ))}
        </div>
        <p className="wc-samples__text">{messages.samples.typeMarks.note}</p>
      </Section>

      <Section
        title={messages.samples.longContent.title}
        description={messages.samples.longContent.lead}
      >
        <div className="wc-samples__long">
          <h3 className="wc-samples__long-title">
            {messages.samples.longContent.heading}
          </h3>
          <p className="wc-samples__prose">
            {messages.samples.longContent.paragraph}
          </p>
          <p className="wc-samples__long-value">
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
