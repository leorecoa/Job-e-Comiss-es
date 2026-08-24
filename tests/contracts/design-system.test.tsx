import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthLayout, Badge, Button, EmptyState, FieldMessage, InlineNotice, Input, Label, LoadingState, PageHeader, Surface, Textarea } from '../../components/ui';

describe('branded design system foundations', () => {
  it('exposes predictable component variants without page context', () => {
    const html = renderToStaticMarkup(
      <Surface muted>
        <PageHeader title="Agenda" description="Operacao do dia" />
        <Badge tone="success">Ativo</Badge>
        <Button variant="destructive">Excluir</Button>
        <EmptyState title="Sem horarios" description="Ajuste os filtros." />
      </Surface>
    );

    expect(html).toContain('ui-surface-muted');
    expect(html).toContain('ui-badge-success');
    expect(html).toContain('ui-button-destructive');
    expect(html).toContain('Sem horarios');
  });

  it('makes loading buttons busy and disabled', () => {
    const html = renderToStaticMarkup(<Button loading>Salvando</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
  });

  it('supports accessible field association and error messages', () => {
    const html = renderToStaticMarkup(
      <div>
        <Label htmlFor="client-name">Cliente</Label>
        <Input id="client-name" aria-invalid aria-describedby="client-name-error" />
        <Textarea aria-label="Observacoes" disabled />
        <FieldMessage id="client-name-error" tone="error">Informe o cliente.</FieldMessage>
      </div>
    );

    expect(html).toContain('for="client-name"');
    expect(html).toContain('aria-describedby="client-name-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('disabled=""');
  });

  it('defines semantic tokens and visible focus styles', () => {
    const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
    for (const token of ['background', 'foreground', 'surface', 'border', 'primary', 'success', 'warning', 'destructive', 'focus-ring', 'disabled']) {
      expect(css).toContain(`--color-${token}`);
    }
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
  });

  it('provides reusable accessible auth feedback states', () => {
    const html = renderToStaticMarkup(
      <AuthLayout>
        <InlineNotice tone="error">Falha recuperavel</InlineNotice>
        <LoadingState title="Processando" description="Aguarde" />
      </AuthLayout>
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('ui-auth-shell');
  });
});
