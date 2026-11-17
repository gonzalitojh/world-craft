// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { Check, Map } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithI18n } from '../helpers/render';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Superficies no interactivas (issue #8, fase 2): tarjeta, etiqueta de estado y
 * estado vacío. Se comprueba la jerarquía semántica, que la elevación venga del
 * token y que ninguna variante de `Badge` dependa solo del color.
 */

afterEach(cleanup);

describe('Card', () => {
  it('compone encabezado, contenido y pie con jerarquía de encabezados', () => {
    render(
      <Card>
        <CardTitle>Mundos</CardTitle>
        <CardDescription>Tus mundos privados</CardDescription>
        <CardContent>Solo tú y quien invites</CardContent>
        <CardFooter>
          <Button>Crear mundo</Button>
        </CardFooter>
      </Card>,
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'Mundos' }),
    ).toBeTruthy();
    expect(screen.getByText('Tus mundos privados')).toBeTruthy();
    expect(screen.getByText('Solo tú y quien invites')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear mundo' })).toBeTruthy();
  });

  it('usa la elevación de tarjeta y no desborda en flex', () => {
    render(<Card>Contenido</Card>);

    const card = document.querySelector('[data-slot="card"]');

    expect(card?.className).toContain('shadow-card');
    expect(card?.className).toContain('min-w-0');
  });

  it('permite cambiar el nivel del título sin romper la semántica', () => {
    render(<CardTitle as="h2">Mundos</CardTitle>);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Mundos' }),
    ).toBeTruthy();
  });
});

describe('Badge', () => {
  const variants: ReadonlyArray<readonly [BadgeProps['variant'], string]> = [
    ['neutral', 'bg-surface-raised'],
    ['accent', 'bg-accent-muted'],
    ['success', 'bg-success-surface'],
    ['warning', 'bg-warning-surface'],
    ['danger', 'bg-danger-surface'],
    ['info', 'bg-info-surface'],
  ];

  for (const [variant, token] of variants) {
    it(`pinta la variante ${String(variant)} con su token y mantiene el texto`, () => {
      const { unmount } = render(<Badge variant={variant}>Publicado</Badge>);

      const badge = document.querySelector('[data-slot="badge"]');

      expect(badge?.className).toContain(token);
      expect(screen.getByText('Publicado')).toBeTruthy();

      unmount();
    });
  }

  it('acompaña al texto con un icono decorativo', () => {
    render(
      <Badge variant="success" icon={<Check aria-hidden="true" />}>
        Publicado
      </Badge>,
    );

    const badge = document.querySelector('[data-slot="badge"]');
    const icon = badge?.querySelector('svg');

    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(badge?.textContent).toBe('Publicado');
  });

  it('no deja que el texto largo ensanche el contenedor', () => {
    render(<Badge variant="info">Sin publicar · borrador sin revisar</Badge>);

    expect(document.querySelector('[data-slot="badge"]')?.className).toContain(
      'min-w-0',
    );
  });
});

describe('EmptyState', () => {
  it('muestra icono, título, descripción y acción', () => {
    renderWithI18n(
      <EmptyState
        icon={<Map aria-hidden="true" />}
        title="Todavía no hay mapas"
        description="Crea un mapa para situar tus lugares."
        action={<Button>Crear mapa</Button>}
      />,
    );

    expect(screen.getByText('Todavía no hay mapas')).toBeTruthy();
    expect(
      screen.getByText('Crea un mapa para situar tus lugares.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear mapa' })).toBeTruthy();
    expect(
      document
        .querySelector('[data-slot="empty-state"] svg')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('cae al título genérico del catálogo si no se indica', () => {
    renderWithI18n(<EmptyState />);

    expect(screen.getByText('Todavía no hay nada aquí')).toBeTruthy();
  });

  it('pinta el título como h3 por defecto', () => {
    renderWithI18n(<EmptyState title="Todavía no hay mapas" />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Todavía no hay mapas' }),
    ).toBeTruthy();
  });

  it('permite bajar o anular el nivel cuando la página ya tiene su h3', () => {
    const { unmount } = renderWithI18n(
      <EmptyState title="Ningún mapa todavía" titleAs="h4" />,
    );

    expect(
      screen.getByRole('heading', { level: 4, name: 'Ningún mapa todavía' }),
    ).toBeTruthy();

    unmount();

    // `p` no crea encabezado: para un hueco dentro de una lista o una tarjeta.
    renderWithI18n(<EmptyState title="Ningún mapa todavía" titleAs="p" />);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Ningún mapa todavía')).toBeTruthy();
  });
});
