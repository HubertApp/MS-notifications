import { renderEmailLayout } from './email-layout.template';
import { EmailTemplateContent } from './email-template.interface';

describe('renderEmailLayout', () => {
  const minimalContent: EmailTemplateContent = {
    heading: 'Titre du mail',
    bodyHtml: 'Corps du mail',
    footerNoteHtml: 'Note de pied de page',
  };

  it('should include heading, body and footer note in the output', () => {
    const html = renderEmailLayout(minimalContent);

    expect(html).toContain('Titre du mail');
    expect(html).toContain('Corps du mail');
    expect(html).toContain('Note de pied de page');
  });

  it('should be a full, table-based HTML document (no flex/grid, Outlook-safe)', () => {
    const html = renderEmailLayout(minimalContent);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<table');
    expect(html).not.toContain('display:flex');
    expect(html).not.toContain('display:grid');
    expect(html).not.toContain('box-shadow');
  });

  it('should not render a CTA button when none is provided', () => {
    const html = renderEmailLayout(minimalContent);

    expect(html).not.toContain('<a href=');
  });

  it('should render the CTA button with its label and url when provided', () => {
    const html = renderEmailLayout({
      ...minimalContent,
      cta: { label: 'Ouvrir HubertApp', url: 'https://app.hubertapp.example' },
    });

    expect(html).toContain('Ouvrir HubertApp');
    expect(html).toContain('https://app.hubertapp.example');
  });

  it('should not render a feature list when none is provided', () => {
    const html = renderEmailLayout(minimalContent);

    expect(html).not.toContain('EAF9FB');
  });

  it('should render every feature row label when provided', () => {
    const html = renderEmailLayout({
      ...minimalContent,
      featureRows: [
        { badge: '&#8594;', label: 'Première fonctionnalité' },
        { badge: '&#9733;', label: 'Deuxième fonctionnalité' },
      ],
    });

    expect(html).toContain('Première fonctionnalité');
    expect(html).toContain('Deuxième fonctionnalité');
  });
});
