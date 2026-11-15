// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/**
 * Contrato de los campos de formulario (issue #8, fase 2).
 *
 * Lo que se comprueba aquí no es el aspecto sino la asociación accesible:
 * etiqueta ↔ control, descripción y error por `aria-describedby`, estado
 * inválido por `aria-invalid` y que el selector sea el nativo.
 */

afterEach(cleanup);

describe('Field', () => {
  it('asocia la etiqueta al control por htmlFor/id', () => {
    render(
      <Field label="Nombre" description="Aparece en el mapa">
        {(control) => <Input {...control} placeholder="Eldoria" />}
      </Field>,
    );

    const label = screen.getByText('Nombre');
    const input = screen.getByLabelText('Nombre');

    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.id).not.toBe('');
  });

  it('enlaza la descripción con aria-describedby', () => {
    render(
      <Field label="Nombre" description="Aparece en el mapa">
        {(control) => <Input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText('Nombre');
    const description = screen.getByText('Aparece en el mapa');

    expect(input.getAttribute('aria-describedby')).toBe(description.id);
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('marca el control como inválido y enlaza el error', () => {
    render(
      <Field
        label="Identificador"
        error="El identificador no puede estar vacío"
      >
        {(control) => <Input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText('Identificador');
    const error = screen.getByText('El identificador no puede estar vacío');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
    expect(input.className).toContain('aria-[invalid=true]:border-danger');
  });

  it('concatena descripción y error en el orden de lectura', () => {
    render(
      <Field
        label="Identificador"
        description="Solo minúsculas y guiones"
        error="Ya existe otro mundo con ese identificador"
      >
        {(control) => <Input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText('Identificador');
    const describedBy =
      input.getAttribute('aria-describedby')?.split(' ') ?? [];

    expect(describedBy).toHaveLength(2);
    expect(describedBy[0]).toBe(
      screen.getByText('Solo minúsculas y guiones').id,
    );
    expect(describedBy[1]).toBe(
      screen.getByText('Ya existe otro mundo con ese identificador').id,
    );
  });

  it('funciona igual con un textarea', () => {
    render(
      <Field label="Sinopsis" error="La sinopsis es demasiado larga">
        {(control) => <Textarea {...control} />}
      </Field>,
    );

    const textarea = screen.getByLabelText('Sinopsis');

    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.getAttribute('aria-describedby')).toBe(
      screen.getByText('La sinopsis es demasiado larga').id,
    );
  });

  it('funciona igual con un select nativo', () => {
    render(
      <Field label="Tipo de ficha">
        {(control) => (
          <Select {...control}>
            <option value="character">Personaje</option>
            <option value="place">Lugar</option>
          </Select>
        )}
      </Field>,
    );

    const select = screen.getByLabelText('Tipo de ficha');

    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('combobox')).toBe(select);
  });
});

describe('Input', () => {
  it('acepta aria-invalid y aria-describedby del consumidor', () => {
    render(
      <>
        <span id="ayuda">Solo minúsculas</span>
        <Input aria-label="Slug" aria-invalid aria-describedby="ayuda" />
      </>,
    );

    const input = screen.getByLabelText('Slug');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('ayuda');
    expect(input.className).toContain('h-11');
    expect(input.className).toContain('min-w-0');
  });

  it('permite anular el tipo por defecto', () => {
    render(<Input aria-label="Correo" type="email" />);

    expect(screen.getByLabelText('Correo').getAttribute('type')).toBe('email');
  });
});

describe('Textarea', () => {
  it('arranca con altura suficiente en móvil y permite redimensionar', () => {
    render(<Textarea aria-label="Notas" />);

    const textarea = screen.getByLabelText('Notas');

    expect(textarea.className).toContain('min-h-28');
    expect(textarea.className).toContain('resize-y');
    expect((textarea as HTMLTextAreaElement).rows).toBe(4);
  });
});

describe('Select', () => {
  it('es un select nativo con chevron decorativo', () => {
    render(
      <Select aria-label="Orden">
        <option value="name">Nombre</option>
      </Select>,
    );

    const select = screen.getByRole('combobox');
    const chevron = select.parentElement?.querySelector('svg');

    expect(select.tagName).toBe('SELECT');
    expect(select.className).toContain('appearance-none');
    expect(chevron?.getAttribute('aria-hidden')).toBe('true');
  });

  it('mantiene las opciones como contenido real del select', () => {
    render(
      <Select aria-label="Orden">
        <option value="name">Nombre</option>
        <option value="date">Fecha</option>
      </Select>,
    );

    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});
