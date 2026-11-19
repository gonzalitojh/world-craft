import { useState, type ReactNode } from 'react';

import logoUrl from '../assets/world-craft-logo.svg';
import { Button } from '../components/button';
import { cx } from '../lib/class-names';
import { messages } from '../messages/es';
import type { ThemeMode } from '../theme';

export type AppView = 'home' | 'samples';

export interface AppShellProps {
  readonly view: AppView;
  readonly onViewChange: (view: AppView) => void;
  readonly theme: ThemeMode;
  readonly onToggleTheme: () => void;
  /** Versión visible al pie del rail; la pasa `App` desde el preload. */
  readonly version: string;
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

function SamplesIcon() {
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
      <path d="m12 4 8 4-8 4-8-4Z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { readonly collapsed: boolean }) {
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
      <path d={collapsed ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="wc-button__icon"
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
      className="wc-button__icon"
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
  { id: 'home', label: messages.shell.views.home, icon: <HomeIcon /> },
  { id: 'samples', label: messages.shell.views.samples, icon: <SamplesIcon /> },
] as const;

/**
 * Shell de escritorio sin router.
 *
 * La vista y el tema los controla `App`; el rail recuerda su estado plegado
 * mientras dura la sesión. Semántica: `aside` para el rail, `nav` para la
 * navegación, `header` para la barra superior y `main` como destino del enlace
 * de salto, con `tabIndex={-1}` para poder enfocarlo.
 */
export function AppShell({
  view,
  onViewChange,
  theme,
  onToggleTheme,
  version,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const themeLabel =
    theme === 'dark'
      ? messages.shell.theme.currentDark
      : messages.shell.theme.currentLight;
  const collapseLabel = collapsed
    ? messages.shell.expand
    : messages.shell.collapse;

  return (
    <>
      <a className="wc-skip-link" href="#wc-main">
        {messages.shell.skipToContent}
      </a>
      <div className={cx('wc-shell', collapsed && 'wc-shell--collapsed')}>
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
                collapsed && 'wc-visually-hidden',
              )}
            >
              {messages.shell.brandName}
              <span className="wc-shell__brand-tagline">
                {messages.shell.brandTagline}
              </span>
            </span>
          </div>

          <nav
            className="wc-shell__nav"
            id="wc-navigation"
            aria-label={messages.shell.navigationLabel}
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="wc-nav-item"
                title={collapsed ? item.label : undefined}
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => {
                  onViewChange(item.id);
                }}
              >
                {item.icon}
                <span
                  className={cx(
                    'wc-nav-item__label',
                    collapsed && 'wc-visually-hidden',
                  )}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="wc-shell__rail-footer">
            <button
              type="button"
              className="wc-nav-item wc-shell__collapse"
              title={collapsed ? collapseLabel : undefined}
              aria-expanded={!collapsed}
              aria-controls="wc-navigation"
              onClick={() => {
                setCollapsed((current) => !current);
              }}
            >
              <CollapseIcon collapsed={collapsed} />
              <span
                className={cx(
                  'wc-nav-item__label',
                  collapsed && 'wc-visually-hidden',
                )}
              >
                {collapseLabel}
              </span>
            </button>
            <p
              className={cx(
                'wc-shell__version',
                collapsed && 'wc-visually-hidden',
              )}
            >
              {messages.shell.version(version)}
            </p>
          </div>
        </aside>

        <div className="wc-shell__workspace">
          <header className="wc-topbar">
            <h1 className="wc-topbar__title">{messages.shell.views[view]}</h1>
            <div className="wc-topbar__actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={onToggleTheme}
                aria-label={messages.shell.theme.switchLabel(themeLabel)}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                <span>{themeLabel}</span>
              </Button>
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
