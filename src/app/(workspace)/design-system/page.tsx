import {
  AlertTriangle,
  CheckCircle2,
  CircleCheck,
  Info,
  OctagonAlert,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { CommandLauncher } from '@/components/design-system/command-launcher';
import { DialogDemo } from '@/components/design-system/dialog-demo';
import { DrawerDemo } from '@/components/design-system/drawer-demo';
import { FieldDemo } from '@/components/design-system/field-demo';
import { FormDemo } from '@/components/design-system/form-demo';
import { DesignSection, Specimen } from '@/components/design-system/specimen';
import { TabsDemo } from '@/components/design-system/tabs-demo';
import { ToastDemo } from '@/components/design-system/toast-demo';
import { TooltipDemo } from '@/components/design-system/tooltip-demo';
import { PageShell } from '@/components/page-shell';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { ThemeSelector } from '@/components/theme/theme-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { contrastRatio, formatContrastRatio } from '@/lib/contrast';
import { getI18n } from '@/lib/i18n/server';
import { getBreadcrumbs } from '@/lib/navigation';
import {
  PALETTE,
  type PaletteToken,
  type ResolvedThemeName,
} from '@/lib/theme-palette';
import { cn } from '@/lib/utils';
import type { MessageKey } from '@/messages/translator';

/**
 * Página viva del sistema de diseño (issue #8, fase 3).
 *
 * Es un Server Component: solo las islas con estado (diálogo, panel, pestañas,
 * avisos, formulario y paleta de comandos) son componentes cliente. Todo lo
 * demás —tokens, tipografía, tarjetas, etiquetas y estados— se pinta en el
 * servidor, así que la página que se revisa es la misma que se sirve.
 *
 * Los ratios de contraste se calculan aquí con `lib/contrast` a partir de la
 * paleta en TypeScript, que `tests/unit/tokens.test.ts` compara con
 * `palette.css`: no hay números escritos a mano.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();

  return { title: t('nav.design') };
}

/** Secciones ancladas, en el orden del documento. */
const SECTIONS: ReadonlyArray<{ id: string; labelKey: MessageKey }> = [
  { id: 'fundamentos', labelKey: 'design.sections.foundations' },
  { id: 'componentes', labelKey: 'design.sections.components' },
  { id: 'patrones', labelKey: 'design.sections.patterns' },
  { id: 'accesibilidad', labelKey: 'design.sections.accessibility' },
  { id: 'capturas', labelKey: 'design.sections.captures' },
];

/** Los dos temas pintados, con su etiqueta centralizada. */
const THEMES: ReadonlyArray<{
  theme: ResolvedThemeName;
  labelKey: MessageKey;
}> = [
  { theme: 'light', labelKey: 'design.palette.lightLabel' },
  { theme: 'dark', labelKey: 'design.palette.darkLabel' },
];

/** Paleta cruda: cada token con su nombre del catálogo. */
const RAW_TOKENS: ReadonlyArray<{ token: PaletteToken; labelKey: MessageKey }> =
  [
    { token: 'paper', labelKey: 'design.palette.tokens.paper' },
    { token: 'paper-raised', labelKey: 'design.palette.tokens.paper-raised' },
    { token: 'paper-sunken', labelKey: 'design.palette.tokens.paper-sunken' },
    { token: 'ink', labelKey: 'design.palette.tokens.ink' },
    { token: 'ink-muted', labelKey: 'design.palette.tokens.ink-muted' },
    { token: 'border', labelKey: 'design.palette.tokens.border' },
    { token: 'border-strong', labelKey: 'design.palette.tokens.border-strong' },
    { token: 'accent', labelKey: 'design.palette.tokens.accent' },
    { token: 'accent-strong', labelKey: 'design.palette.tokens.accent-strong' },
    { token: 'accent-ink', labelKey: 'design.palette.tokens.accent-ink' },
    { token: 'accent-muted', labelKey: 'design.palette.tokens.accent-muted' },
    { token: 'danger', labelKey: 'design.palette.tokens.danger' },
    { token: 'success', labelKey: 'design.palette.tokens.success' },
    { token: 'warning', labelKey: 'design.palette.tokens.warning' },
    { token: 'info', labelKey: 'design.palette.tokens.info' },
    { token: 'focus', labelKey: 'design.palette.tokens.focus' },
  ];

/** Parejas semánticas con su ratio medido y el mínimo que exige AA. */
const CONTRAST_PAIRS: ReadonlyArray<{
  id: string;
  labelKey: MessageKey;
  foreground: PaletteToken;
  background: PaletteToken;
  minimum: number;
}> = [
  {
    id: 'foreground',
    labelKey: 'design.palette.pairs.foreground',
    foreground: 'ink',
    background: 'paper',
    minimum: 4.5,
  },
  {
    id: 'muted',
    labelKey: 'design.palette.pairs.muted',
    foreground: 'ink-muted',
    background: 'paper',
    minimum: 4.5,
  },
  {
    id: 'accent',
    labelKey: 'design.palette.pairs.accent',
    foreground: 'accent',
    background: 'paper',
    minimum: 4.5,
  },
  {
    id: 'accent-ink',
    labelKey: 'design.palette.pairs.accent-ink',
    foreground: 'accent-ink',
    background: 'accent',
    minimum: 4.5,
  },
  {
    id: 'focus',
    labelKey: 'design.palette.pairs.focus',
    foreground: 'focus',
    background: 'paper',
    minimum: 3,
  },
  {
    id: 'danger',
    labelKey: 'design.palette.pairs.danger',
    foreground: 'danger',
    background: 'danger-surface',
    minimum: 4.5,
  },
  {
    id: 'success',
    labelKey: 'design.palette.pairs.success',
    foreground: 'success',
    background: 'success-surface',
    minimum: 4.5,
  },
  {
    id: 'warning',
    labelKey: 'design.palette.pairs.warning',
    foreground: 'warning',
    background: 'warning-surface',
    minimum: 4.5,
  },
  {
    id: 'info',
    labelKey: 'design.palette.pairs.info',
    foreground: 'info',
    background: 'info-surface',
    minimum: 4.5,
  },
];

/** Papeles semánticos: la utilidad que usa el componente y su muestra. */
const SEMANTIC_SWATCHES: ReadonlyArray<{
  id: string;
  code: string;
  swatch: string;
}> = [
  { id: 'surface', code: 'bg-surface', swatch: 'bg-surface' },
  {
    id: 'surface-raised',
    code: 'bg-surface-raised',
    swatch: 'bg-surface-raised',
  },
  {
    id: 'surface-sunken',
    code: 'bg-surface-sunken',
    swatch: 'bg-surface-sunken',
  },
  { id: 'foreground', code: 'text-foreground', swatch: 'bg-foreground' },
  {
    id: 'muted-foreground',
    code: 'text-muted-foreground',
    swatch: 'bg-muted-foreground',
  },
  { id: 'border', code: 'border-border', swatch: 'border-2 border-border' },
  {
    id: 'border-strong',
    code: 'border-border-strong',
    swatch: 'border-2 border-border-strong',
  },
  { id: 'accent', code: 'bg-accent', swatch: 'bg-accent' },
  { id: 'accent-strong', code: 'bg-accent-strong', swatch: 'bg-accent-strong' },
  { id: 'accent-muted', code: 'bg-accent-muted', swatch: 'bg-accent-muted' },
  {
    id: 'accent-ink',
    code: 'text-accent-ink',
    swatch: 'bg-accent text-accent-ink',
  },
  { id: 'danger', code: 'bg-danger', swatch: 'bg-danger' },
  { id: 'success', code: 'bg-success', swatch: 'bg-success' },
  { id: 'warning', code: 'bg-warning', swatch: 'bg-warning' },
  { id: 'info', code: 'bg-info', swatch: 'bg-info' },
  { id: 'focus', code: 'ring-focus', swatch: 'bg-focus' },
];

/** Escala de espaciado usada por los componentes (pasos de Tailwind). */
const SPACING_STEPS: ReadonlyArray<{ step: string; rem: number }> = [
  { step: '1', rem: 0.25 },
  { step: '2', rem: 0.5 },
  { step: '3', rem: 0.75 },
  { step: '4', rem: 1 },
  { step: '6', rem: 1.5 },
  { step: '8', rem: 2 },
  { step: '12', rem: 3 },
  { step: '16', rem: 4 },
];

/** Radios del sistema, con su utilidad. */
const RADII: ReadonlyArray<{ id: string; code: string; className: string }> = [
  { id: 'sm', code: 'rounded-sm', className: 'rounded-sm' },
  { id: 'md', code: 'rounded-md', className: 'rounded-md' },
  { id: 'lg', code: 'rounded-lg', className: 'rounded-lg' },
  { id: 'xl', code: 'rounded-xl', className: 'rounded-xl' },
  { id: 'full', code: 'rounded-full', className: 'rounded-full' },
];

/** Elevaciones disponibles, con su utilidad. */
const ELEVATIONS: ReadonlyArray<{
  id: 'card' | 'dialog' | 'rail';
  code: string;
  className: string;
}> = [
  { id: 'card', code: 'shadow-card', className: 'shadow-card' },
  { id: 'dialog', code: 'shadow-dialog', className: 'shadow-dialog' },
  { id: 'rail', code: 'shadow-rail', className: 'shadow-rail' },
];

/** Estados con su etiqueta, siempre con icono y texto además del tono. */
const STATES: ReadonlyArray<{
  id: string;
  labelKey: MessageKey;
  variant: 'success' | 'warning' | 'danger' | 'info';
  icon: LucideIcon;
}> = [
  {
    id: 'success',
    labelKey: 'design.states.success',
    variant: 'success',
    icon: CheckCircle2,
  },
  {
    id: 'warning',
    labelKey: 'design.states.warning',
    variant: 'warning',
    icon: AlertTriangle,
  },
  {
    id: 'danger',
    labelKey: 'design.states.danger',
    variant: 'danger',
    icon: OctagonAlert,
  },
  { id: 'info', labelKey: 'design.states.info', variant: 'info', icon: Info },
];

/** Etiqueta de estado con su icono decorativo; el texto nunca falta. */
function StateBadge({
  state,
  label,
}: {
  state: (typeof STATES)[number];
  label: string;
}): ReactNode {
  const Icon = state.icon;

  return (
    <Badge variant={state.variant} icon={<Icon aria-hidden="true" />}>
      {label}
    </Badge>
  );
}

export default async function DesignSystemPage() {
  const { t, locale, messages } = await getI18n();
  const design = messages.design;

  return (
    <PageShell>
      <header className="min-w-0">
        <p className="font-mono text-eyebrow uppercase tracking-eyebrow text-muted-foreground">
          {design.eyebrow}
        </p>
        <h1 className="mt-3 max-w-(--prose-max) min-w-0 font-display text-display-lg tracking-display text-foreground">
          {design.title}
        </h1>
        <p className="mt-4 max-w-(--prose-max) min-w-0 text-lg leading-relaxed text-muted-foreground">
          {design.description}
        </p>
        <div className="mt-6 flex min-w-0 flex-wrap items-center gap-3">
          <CommandLauncher />
          <Button asChild variant="link">
            <Link href="/">{t('nav.home')}</Link>
          </Button>
        </div>
        <dl className="mt-8 grid min-w-0 gap-4 border-y py-4 sm:grid-cols-3">
          {[
            { label: design.meta.themesLabel, value: design.meta.themesValue },
            {
              label: design.meta.contrastLabel,
              value: design.meta.contrastValue,
            },
            { label: design.meta.widthsLabel, value: design.meta.widthsValue },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="font-mono text-xs uppercase tracking-eyebrow text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 min-w-0 break-words text-sm text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <nav aria-label={t('a11y.sectionNavigation')} className="mt-4 min-w-0">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-muted-foreground">
            {design.contentsLabel}
          </p>
          <ul className="mt-2 flex min-w-0 flex-wrap gap-x-5 gap-y-2 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id} className="min-w-0">
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline"
                >
                  {t(section.labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <DesignSection
        id="fundamentos"
        title={design.sections.foundations}
        note={design.sectionNotes.foundations}
      >
        <Specimen
          id="fundamentos-paleta-cruda"
          title={design.palette.rawTitle}
          note={design.palette.rawNote}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {RAW_TOKENS.map(({ token, labelKey }) => (
            <div
              key={token}
              className="flex min-w-0 items-center gap-3 rounded-md border bg-surface p-2"
            >
              <div className="flex shrink-0 overflow-hidden rounded-sm border">
                {THEMES.map(({ theme }) => (
                  <span
                    aria-hidden="true"
                    key={theme}
                    className="block size-8"
                    style={{
                      backgroundColor: `var(--craft-${token}-${theme})`,
                    }}
                  />
                ))}
              </div>
              <div className="min-w-0">
                <p className="min-w-0 break-words text-sm text-foreground">
                  {t(labelKey)}
                </p>
                <p className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                  {PALETTE.light[token]} · {PALETTE.dark[token]}
                </p>
              </div>
            </div>
          ))}
        </Specimen>

        <Specimen
          id="fundamentos-paleta-semantica"
          title={design.palette.semanticTitle}
          note={design.palette.semanticNote}
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        >
          {SEMANTIC_SWATCHES.map((item) => (
            <div
              key={item.id}
              className="flex min-w-0 items-center gap-2 rounded-md border bg-surface p-2"
            >
              <span
                aria-hidden="true"
                className={cn('block size-8 shrink-0 rounded-sm', item.swatch)}
              />
              <code className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                {item.code}
              </code>
            </div>
          ))}
        </Specimen>

        <Specimen
          id="fundamentos-contraste"
          title={design.palette.contrastTitle}
          note={design.palette.contrastNote}
          className="grid gap-6 sm:grid-cols-2"
        >
          {THEMES.map(({ theme, labelKey }) => (
            <div key={theme} className="min-w-0">
              <h4 className="font-mono text-xs uppercase tracking-eyebrow text-muted-foreground">
                {t(labelKey)}
              </h4>
              <ul className="mt-2 grid gap-1.5">
                {CONTRAST_PAIRS.map((pair) => {
                  const ratio = contrastRatio(
                    PALETTE[theme][pair.foreground],
                    PALETTE[theme][pair.background],
                  );

                  return (
                    <li
                      key={pair.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border bg-surface p-1.5"
                    >
                      <span className="min-w-0 break-words text-xs text-muted-foreground">
                        {t(pair.labelKey)}
                      </span>
                      <span
                        className="shrink-0 rounded-sm px-2 py-1 font-mono text-xs"
                        style={{
                          backgroundColor: PALETTE[theme][pair.background],
                          color: PALETTE[theme][pair.foreground],
                        }}
                      >
                        Aa {formatContrastRatio(ratio, locale)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Specimen>

        <Specimen
          id="fundamentos-tipografia"
          title={design.typography.title}
          note={design.typography.note}
          className="flex-col items-stretch"
        >
          <ul className="grid min-w-0 gap-4">
            {[
              {
                code: 'text-display-xl',
                className: 'text-display-xl',
                sample: design.typography.displayXl,
              },
              {
                code: 'text-display-lg',
                className: 'text-display-lg',
                sample: design.typography.displayLg,
              },
              {
                code: 'text-display-md',
                className: 'text-display-md',
                sample: design.typography.displayMd,
              },
              {
                code: 'text-display-sm',
                className: 'text-display-sm',
                sample: design.typography.displaySm,
              },
            ].map((item) => (
              <li key={item.code} className="min-w-0">
                <code className="font-mono text-xs text-muted-foreground">
                  {item.code}
                </code>
                <p
                  className={cn(
                    'min-w-0 break-words font-display text-foreground',
                    item.className,
                  )}
                >
                  {item.sample}
                </p>
              </li>
            ))}
            <li className="min-w-0">
              <code className="font-mono text-xs text-muted-foreground">
                text-base · font-sans
              </code>
              <p className="mt-1 max-w-(--prose-max) min-w-0 break-words leading-relaxed text-foreground">
                {design.typography.body}
              </p>
            </li>
            <li className="min-w-0">
              <code className="font-mono text-xs text-muted-foreground">
                font-mono
              </code>
              <p className="mt-1 min-w-0 break-all font-mono text-sm text-foreground">
                {design.typography.mono}
              </p>
            </li>
            <li className="min-w-0">
              <code className="font-mono text-xs text-muted-foreground">
                text-eyebrow · tracking-eyebrow
              </code>
              <p className="mt-1 min-w-0 break-words font-mono text-eyebrow uppercase tracking-eyebrow text-muted-foreground">
                {design.typography.eyebrow}
              </p>
            </li>
          </ul>
        </Specimen>

        <Specimen
          id="fundamentos-espaciado"
          title={design.spacing.title}
          note={design.spacing.note}
          className="flex-col items-stretch"
        >
          <ul className="grid min-w-0 gap-2">
            {SPACING_STEPS.map((item) => (
              <li
                key={item.step}
                className="flex min-w-0 items-center gap-3 text-sm"
              >
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                  {item.step}
                </span>
                <span
                  aria-hidden="true"
                  className="block h-3 rounded-sm bg-accent"
                  style={{ width: `${item.rem}rem` }}
                />
                <span className="min-w-0 font-mono text-xs text-muted-foreground">
                  {item.rem}rem
                </span>
              </li>
            ))}
          </ul>
        </Specimen>

        <Specimen
          id="fundamentos-radios"
          title={design.radii.title}
          note={design.radii.note}
        >
          {RADII.map((radius) => (
            <div key={radius.id} className="flex min-w-0 flex-col gap-1">
              <span
                aria-hidden="true"
                className={cn(
                  'block size-14 border-2 border-border bg-surface-sunken',
                  radius.className,
                )}
              />
              <code className="font-mono text-xs text-muted-foreground">
                {radius.code}
              </code>
            </div>
          ))}
        </Specimen>

        <Specimen
          id="fundamentos-elevacion"
          title={design.elevation.title}
          note={design.elevation.note}
        >
          {ELEVATIONS.map((elevation) => (
            <div key={elevation.id} className="flex min-w-0 flex-col gap-1">
              <span
                className={cn(
                  'flex size-20 items-center justify-center rounded-lg border bg-surface-raised font-display text-sm text-foreground',
                  elevation.className,
                )}
              >
                {design.elevation[elevation.id]}
              </span>
              <code className="font-mono text-xs text-muted-foreground">
                {elevation.code}
              </code>
            </div>
          ))}
        </Specimen>

        <Specimen
          id="fundamentos-estados"
          title={design.states.title}
          note={design.states.note}
        >
          {STATES.map((state) => (
            <StateBadge
              key={state.id}
              state={state}
              label={t(state.labelKey)}
            />
          ))}
        </Specimen>
      </DesignSection>

      <DesignSection
        id="componentes"
        title={design.sections.components}
        note={design.sectionNotes.components}
      >
        <Specimen
          id="componentes-boton"
          title={design.components.button.title}
          note={design.components.button.note}
          className="flex-col items-stretch"
        >
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-eyebrow text-muted-foreground">
              {design.components.button.variants}
            </p>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <Button>{design.components.button.primary}</Button>
              <Button variant="outline">
                {design.components.button.outline}
              </Button>
              <Button variant="ghost">{design.components.button.ghost}</Button>
              <Button variant="destructive">
                {design.components.button.destructive}
              </Button>
              <Button variant="link">{design.components.button.link}</Button>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-eyebrow text-muted-foreground">
              {design.components.button.sizes}
            </p>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <Button size="sm">{design.components.button.small}</Button>
              <Button>{design.components.button.primary}</Button>
              <Button size="lg">{design.components.button.large}</Button>
              <Button size="icon" aria-label={design.components.button.icon}>
                <Search aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-eyebrow text-muted-foreground">
              {design.components.button.states}
            </p>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <Button disabled>{design.components.button.disabled}</Button>
              <Button loading>{design.components.button.loading}</Button>
            </div>
          </div>
        </Specimen>

        <Specimen
          id="componentes-campo"
          title={design.components.input.title}
          note={design.components.input.note}
          className="flex-col items-stretch"
        >
          <div className="grid min-w-0 gap-3 sm:max-w-md">
            <label
              className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-foreground"
              htmlFor="demo-input"
            >
              {design.components.input.label}
              <Input
                id="demo-input"
                placeholder={design.components.input.placeholder}
                aria-describedby="demo-input-help"
              />
            </label>
            <p id="demo-input-help" className="text-sm text-muted-foreground">
              {design.components.input.description}
            </p>
            <label
              className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-foreground"
              htmlFor="demo-input-disabled"
            >
              {design.components.input.disabledLabel}
              <Input
                id="demo-input-disabled"
                defaultValue={design.components.input.disabledValue}
                disabled
              />
            </label>
            <label
              className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-foreground"
              htmlFor="demo-input-invalid"
            >
              {design.components.field.errorLabel}
              <Input
                id="demo-input-invalid"
                aria-invalid
                aria-describedby="demo-input-error"
                defaultValue=""
              />
            </label>
            <p
              id="demo-input-error"
              className="text-sm font-medium text-danger"
            >
              {design.components.field.error}
            </p>
          </div>
        </Specimen>

        <Specimen
          id="componentes-campo-etiqueta"
          title={design.components.field.title}
          note={design.components.field.note}
          className="flex-col items-stretch"
        >
          <FieldDemo />
        </Specimen>

        <Specimen
          id="componentes-textarea"
          title={design.components.textarea.title}
          note={design.components.textarea.note}
          className="flex-col items-stretch"
        >
          <label
            className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-foreground sm:max-w-md"
            htmlFor="demo-textarea"
          >
            {design.components.textarea.label}
            <Textarea
              id="demo-textarea"
              placeholder={design.components.textarea.placeholder}
            />
          </label>
        </Specimen>

        <Specimen
          id="componentes-select"
          title={design.components.select.title}
          note={design.components.select.note}
          className="flex-col items-stretch"
        >
          <label
            className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-foreground sm:max-w-xs"
            htmlFor="demo-select"
          >
            {design.components.select.label}
            <Select id="demo-select" defaultValue="editor">
              <option value="editor">{design.components.select.editor}</option>
              <option value="viewer">{design.components.select.viewer}</option>
            </Select>
          </label>
          <label
            className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-foreground sm:max-w-xs"
            htmlFor="demo-select-disabled"
          >
            {design.components.select.label}
            <Select id="demo-select-disabled" defaultValue="viewer" disabled>
              <option value="editor">{design.components.select.editor}</option>
              <option value="viewer">{design.components.select.viewer}</option>
            </Select>
          </label>
        </Specimen>

        <Specimen
          id="componentes-tarjeta"
          title={design.components.card.title}
          note={design.components.card.note}
        >
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle as="h4">{design.components.card.heading}</CardTitle>
              <CardDescription>{design.components.card.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="accent">{design.components.badge.accent}</Badge>
            </CardContent>
            <CardFooter>
              <Button variant="link">{design.components.card.footer}</Button>
            </CardFooter>
          </Card>
        </Specimen>

        <Specimen
          id="componentes-etiqueta"
          title={design.components.badge.title}
          note={design.components.badge.note}
        >
          <Badge>{design.components.badge.neutral}</Badge>
          <Badge variant="accent">{design.components.badge.accent}</Badge>
          <Badge variant="success">{design.components.badge.success}</Badge>
          <Badge variant="warning">{design.components.badge.warning}</Badge>
          <Badge variant="danger">{design.components.badge.danger}</Badge>
          <Badge variant="info">{design.components.badge.info}</Badge>
        </Specimen>

        <Specimen
          id="componentes-vacio"
          title={design.components.empty.title}
          note={design.components.empty.note}
          className="flex-col items-stretch"
        >
          <EmptyState
            icon={<Sparkles aria-hidden="true" />}
            title={design.components.empty.heading}
            titleAs="h4"
            description={design.components.empty.body}
            action={<Button>{design.components.empty.action}</Button>}
          />
        </Specimen>

        <Specimen
          id="componentes-dialogo"
          title={design.components.dialog.title}
          note={design.components.dialog.note}
        >
          <DialogDemo />
        </Specimen>

        <Specimen
          id="componentes-panel"
          title={design.components.drawer.title}
          note={design.components.drawer.note}
          className="flex-col items-stretch"
        >
          <DrawerDemo />
        </Specimen>

        <Specimen
          id="componentes-pestanas"
          title={design.components.tabs.title}
          note={design.components.tabs.note}
          className="flex-col items-stretch"
        >
          <TabsDemo />
        </Specimen>

        <Specimen
          id="componentes-avisos"
          title={design.components.toast.title}
          note={design.components.toast.note}
        >
          <ToastDemo />
        </Specimen>

        <Specimen
          id="componentes-globo"
          title={design.components.tooltip.title}
          note={design.components.tooltip.note}
        >
          <TooltipDemo />
        </Specimen>

        <Specimen
          id="componentes-comandos"
          title={design.components.command.title}
          note={design.components.command.note}
        >
          <CommandLauncher label={design.components.command.trigger} />
        </Specimen>

        <Specimen
          id="componentes-tema"
          title={design.components.theme.title}
          note={design.components.theme.note}
        >
          <ThemeSelector />
        </Specimen>
      </DesignSection>

      <DesignSection
        id="patrones"
        title={design.sections.patterns}
        note={design.sectionNotes.patterns}
      >
        <Specimen
          id="patrones-formulario"
          title={design.patterns.form.title}
          note={design.patterns.form.note}
          className="flex-col items-stretch"
        >
          <FormDemo />
        </Specimen>

        <Specimen
          id="patrones-vacio"
          title={design.patterns.empty.title}
          note={design.patterns.empty.note}
          className="flex-col items-stretch"
        >
          <EmptyState
            icon={<CircleCheck aria-hidden="true" />}
            title={design.patterns.empty.heading}
            titleAs="h4"
            description={design.patterns.empty.body}
            action={
              <Button variant="outline">
                {design.components.empty.action}
              </Button>
            }
          />
        </Specimen>

        <Specimen
          id="patrones-cabecera"
          title={design.patterns.header.title}
          note={design.patterns.header.note}
          className="flex-col items-start"
        >
          <Breadcrumbs
            items={getBreadcrumbs('/design-system')}
            label={design.patterns.header.title}
          />
        </Specimen>
      </DesignSection>

      <DesignSection
        id="accesibilidad"
        title={design.sections.accessibility}
        note={design.sectionNotes.accessibility}
      >
        <Specimen
          id="accesibilidad-tabulacion"
          title={design.accessibility.tabOrderTitle}
          note={design.accessibility.tabOrderNote}
          className="flex-col items-stretch"
        >
          <ol className="grid min-w-0 list-decimal gap-2 pl-5 text-sm text-foreground">
            {design.accessibility.tabOrder.map((item) => (
              <li key={item} className="min-w-0 break-words">
                {item}
              </li>
            ))}
          </ol>
        </Specimen>

        <Specimen
          id="accesibilidad-foco"
          title={design.accessibility.focusTitle}
          note={design.accessibility.focusNote}
        >
          <Button variant="outline">{design.accessibility.focusAction}</Button>
          <Input
            aria-label={design.accessibility.focusAction}
            className="max-w-xs"
          />
        </Specimen>

        <Specimen
          id="accesibilidad-teclas"
          title={design.accessibility.keysTitle}
          note={design.accessibility.keysNote}
          className="flex-col items-stretch"
        >
          <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
            {design.accessibility.keys.map((entry) => (
              <div
                key={entry.keys}
                className="min-w-0 rounded-md border bg-surface p-3"
              >
                <dt className="font-mono text-xs text-accent">{entry.keys}</dt>
                <dd className="mt-1 min-w-0 break-words text-sm text-muted-foreground">
                  {entry.action}
                </dd>
              </div>
            ))}
          </dl>
        </Specimen>

        <Specimen
          id="accesibilidad-color"
          title={design.accessibility.colorTitle}
          note={design.accessibility.colorNote}
          className="flex-col items-stretch"
        >
          <div className="flex min-w-0 flex-wrap gap-2">
            {STATES.map((state) => (
              <StateBadge
                key={state.id}
                state={state}
                label={t(state.labelKey)}
              />
            ))}
          </div>
        </Specimen>

        <Specimen
          id="accesibilidad-movimiento"
          title={design.accessibility.motionTitle}
          note={design.accessibility.motionNote}
          className="flex-col items-stretch"
        >
          <p className="max-w-(--prose-max) min-w-0 break-words text-sm text-foreground">
            {design.typography.longTextTitle}
          </p>
          <p className="max-w-(--prose-max) min-w-0 break-words text-sm leading-relaxed text-muted-foreground">
            {design.typography.longText}
          </p>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {design.typography.longWordTitle}
            </p>
            <p className="mt-1 min-w-0 break-words font-mono text-sm text-accent">
              {design.typography.longWord}
            </p>
            <p className="mt-2 max-w-(--prose-max) min-w-0 break-words text-sm text-muted-foreground">
              {design.typography.longWordNote}
            </p>
          </div>
        </Specimen>
      </DesignSection>

      <DesignSection
        id="capturas"
        title={design.sections.captures}
        note={design.sectionNotes.captures}
      >
        <div className="min-w-0">
          <p className="max-w-(--prose-max) min-w-0 text-sm leading-relaxed text-muted-foreground">
            {design.captures.note}
          </p>
          <ul className="mt-4 grid min-w-0 gap-1.5">
            {design.captures.paths.map((path) => (
              <li key={path} className="min-w-0">
                <code className="block min-w-0 break-all font-mono text-sm text-foreground">
                  {path}
                </code>
              </li>
            ))}
          </ul>
          <p className="mt-3 min-w-0 text-sm text-muted-foreground">
            {design.captures.regenerate}
          </p>
        </div>
      </DesignSection>
    </PageShell>
  );
}
