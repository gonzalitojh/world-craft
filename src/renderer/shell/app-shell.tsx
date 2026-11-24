import { Fragment, useState, type ReactNode } from 'react';

import logoUrl from '../assets/world-craft-logo.svg';
import { Button } from '../components/button';
import { IconButton } from '../components/icon-button';
import { Menu, type MenuItem } from '../components/menu';
import { Tooltip } from '../components/tooltip';
import { UpdatesControl } from '../components/updates-control';
import { useMessages } from '../i18n/provider';
import { cx } from '../lib/class-names';
import type { ThemeMode } from '../theme';
import type { AppNavView, AppView, ShellPrimaryAction } from './views';

export type { AppNavView, AppView, ShellPrimaryAction } from './views';

export interface AppShellProps {
  readonly view: AppView;
  /** Título de la barra superior; puede ser el nombre de un mundo. */
  readonly title: string;
  readonly onNavigate: (view: AppNavView) => void;
  /** Acción primaria de la vista; como máximo una por pantalla. */
  readonly primaryAction?: ShellPrimaryAction | undefined;
  /** Acciones secundarias de la vista; se muestran en el menú «⋯». */
  readonly secondaryActions?: readonly MenuItem[] | undefined;
  /** Abre la paleta de comandos Ctrl+K. */
  readonly onOpenPalette: () => void;
  readonly theme: ThemeMode;
  readonly onToggleTheme: () => void;
  /** Estado plegado controlado; si falta, el shell lo gestiona. */
  readonly collapsed?: boolean | undefined;
  readonly defaultCollapsed?: boolean | undefined;
  readonly onCollapsedChange?: ((collapsed: boolean) => void) | undefined;
  readonly children: ReactNode;
}

function HomeIcon() {
  return (
    <svg
      className="wc-nav-item__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function SearchIcon({
  className = 'wc-nav-item__icon',
}: {
  readonly className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}

function WorldsIcon() {
  return (
    <svg
      className="wc-nav-item__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4a13 13 0 0 1 0 16a13 13 0 0 1 0-16Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="wc-nav-item__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v4M14 11v4" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { readonly collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={collapsed ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: 'home', icon: <HomeIcon /> },
  { id: 'worlds', icon: <WorldsIcon /> },
  { id: 'trash', icon: <TrashIcon /> },
] as const;

const WORLDS_VIEWS: readonly AppView[] = [
  'worlds',
  'world',
  'entities',
  'entity',
];

/**
 * Shell de escritorio sin router.
 *
 * La vista, el tema y las acciones las controla `App`; el rail recuerda su
 * estado plegado mientras dura la sesión salvo que se controle desde fuera.
 * Semántica: `aside` para el rail, `nav` para la navegación, `header` para la
 * barra superior y `main` como destino del enlace de salto, con `tabIndex={-1}`
 * para poder enfocarlo.
 */
export function AppShell({
  view,
  title,
  onNavigate,
  primaryAction,
  secondaryActions,
  onOpenPalette,
  theme,
  onToggleTheme,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  children,
}: AppShellProps) {
  const messages = useMessages();
  const [uncontrolledCollapsed, setUncontrolledCollapsed] =
    useState(defaultCollapsed);
  const isCollapsed = collapsed ?? uncontrolledCollapsed;
  const themeLabel =
    theme === 'dark'
      ? messages.shell.theme.currentDark
      : messages.shell.theme.currentLight;
  const collapseLabel = isCollapsed
    ? messages.shell.expand
    : messages.shell.collapse;

  const toggleCollapsed = (): void => {
    const next = !isCollapsed;

    if (collapsed === undefined) {
      setUncontrolledCollapsed(next);
    }

    onCollapsedChange?.(next);
  };

  const isCurrent = (id: AppNavView): boolean =>
    id === 'home'
      ? view === 'home'
      : id === 'trash'
        ? view === 'trash'
        : WORLDS_VIEWS.includes(view);

  const renderNavButton = (
    id: AppNavView,
    label: string,
    icon: ReactNode,
  ): ReactNode => (
    <button
      key={id}
      type="button"
      className="wc-nav-item"
      aria-label={isCollapsed ? label : undefined}
      aria-current={isCurrent(id) ? 'page' : undefined}
      onClick={() => {
        onNavigate(id);
      }}
    >
      {icon}
      {isCollapsed ? null : <span className="wc-nav-item__label">{label}</span>}
    </button>
  );

  return (
    <>
      <a
        className="wc-skip-link"
        href="#wc-main"
        onClick={(event) => {
          // El enlace conserva `href` por semántica, pero no cambia el hash:
          // `#wc-main` lo interpretaría el listener de hashchange de `App`
          // como una vista desconocida y devolvería a Inicio. Se enfoca el
          // destino a mano, que también cubre la activación con Enter.
          event.preventDefault();
          document.getElementById('wc-main')?.focus();
        }}
      >
        {messages.shell.skipToContent}
      </a>
      <div className={cx('wc-shell', isCollapsed && 'wc-shell--collapsed')}>
        <aside className="wc-shell__rail" aria-label={messages.shell.railLabel}>
          <div className="wc-shell__brand">
            {/*
              Logotipo de la aplicación. El SVG vive en
              `src/renderer/assets/world-craft-logo.svg` y se muestra con sus
              propios colores. Es decorativo: el nombre accesible lo aporta el
              texto contiguo de la marca.
            */}
            <img
              className="wc-shell__brand-mark"
              src={logoUrl}
              alt=""
              aria-hidden="true"
            />
            <span
              className={cx(
                'wc-shell__brand-name',
                isCollapsed && 'wc-visually-hidden',
              )}
            >
              {messages.shell.brandName}
            </span>
          </div>

          <nav
            className="wc-shell__nav"
            id="wc-navigation"
            aria-label={messages.shell.navigationLabel}
          >
            {NAV_ITEMS.map((item) => {
              const label = messages.shell.views[item.id];
              const button = renderNavButton(item.id, label, item.icon);

              return isCollapsed ? (
                <Tooltip key={item.id} label={label} align="end">
                  {button}
                </Tooltip>
              ) : (
                <Fragment key={item.id}>{button}</Fragment>
              );
            })}
          </nav>

          <div className="wc-shell__rail-footer">
            <IconButton
              className="wc-shell__collapse"
              label={collapseLabel}
              tooltip={collapseLabel}
              icon={<CollapseIcon collapsed={isCollapsed} />}
              aria-expanded={!isCollapsed}
              aria-controls="wc-navigation"
              onClick={toggleCollapsed}
            />
          </div>
        </aside>

        <div className="wc-shell__workspace">
          <header className="wc-topbar">
            <h1 className="wc-topbar__title" title={title}>
              {title}
            </h1>
            <div className="wc-topbar__actions">
              <Tooltip label={messages.shell.searchTrigger}>
                <button
                  type="button"
                  className="wc-topbar__search"
                  aria-label={messages.shell.searchTrigger}
                  aria-keyshortcuts="Control+K"
                  aria-haspopup="dialog"
                  onClick={onOpenPalette}
                >
                  <SearchIcon className="wc-topbar__search-icon" />
                  <span className="wc-topbar__search-label">
                    {messages.shell.searchTrigger}
                  </span>
                  {/*
                    El atajo se pinta con `content: attr(data-keys)` para que
                    el texto visible del botón sea solo «Buscar» y su nombre
                    accesible coincida con la etiqueta (regla label-in-name de
                    axe); el atajo se anuncia con `aria-keyshortcuts`.
                  */}
                  <kbd
                    className="wc-topbar__search-kbd"
                    data-keys={messages.shell.searchShortcut}
                    aria-hidden="true"
                  />
                </button>
              </Tooltip>

              {primaryAction === undefined ? null : (
                <Button
                  variant="primary"
                  size="md"
                  disabled={primaryAction.disabled}
                  onClick={primaryAction.onSelect}
                >
                  {primaryAction.label}
                </Button>
              )}

              {secondaryActions === undefined ||
              secondaryActions.length === 0 ? null : (
                <Menu
                  label={messages.shell.viewMenuLabel}
                  items={secondaryActions}
                  align="end"
                  triggerTooltip={messages.shell.viewMenuLabel}
                />
              )}

              <div className="wc-topbar__utilities">
                <UpdatesControl />
                <IconButton
                  label={messages.shell.theme.switchLabel(themeLabel)}
                  tooltip={messages.shell.theme.switchLabel(themeLabel)}
                  icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                  onClick={onToggleTheme}
                />
              </div>
            </div>
          </header>

          <main className="wc-shell__main" id="wc-main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
