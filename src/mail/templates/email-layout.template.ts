import { EmailTemplateContent } from './email-template.interface';

// Mise en page commune à tous les mails HubertApp.
export function renderEmailLayout(content: EmailTemplateContent): string {
  const featureRowsHtml = content.featureRows?.length
    ? content.featureRows
        .map(
          (row) => `
            <tr>
              <td width="36" valign="top" style="padding:0 12px 14px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="28" height="28" style="background-color:#EAF9FB;border-radius:8px;">
                  <tr><td align="center" valign="middle" style="font-size:13px;line-height:28px;color:#0AB5C9;font-weight:700;">${row.badge}</td></tr>
                </table>
              </td>
              <td valign="middle" style="padding:0 0 14px;color:#2E3D4B;font-size:13.5px;line-height:1.5;">${row.label}</td>
            </tr>`,
        )
        .join('')
    : '';

  const ctaHtml = content.cta
    ? `
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#0AB5C9;border-radius:12px;">
                      <a href="${content.cta.url}" style="display:inline-block;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 28px;">${content.cta.label}</a>
                    </td>
                  </tr>
                </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
  </head>
  <body style="margin:0;padding:0;background-color:#F6F7F4;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F6F7F4;">
      <tr>
        <td align="center" style="padding:40px 16px;">

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td width="36" height="36" align="center" valign="middle" style="background-color:#0AB5C9;border-radius:10px;">
                <span style="color:#ffffff;font-size:17px;font-weight:800;font-family:'Inter',sans-serif;">H</span>
              </td>
              <td style="padding-left:10px;color:#0E1A24;font-size:16px;font-weight:700;letter-spacing:-0.01em;">HubertApp</td>
            </tr>
          </table>

          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border:1px solid #EAECEE;border-radius:20px;">
            <tr>
              <td style="padding:40px 36px 32px;">
                <h1 style="margin:0 0 10px;color:#0E1A24;font-size:21px;font-weight:700;letter-spacing:-0.02em;line-height:1.3;">${content.heading}</h1>
                <p style="margin:0 0 28px;color:#5B6B7A;font-size:14.5px;line-height:1.6;">${content.bodyHtml}</p>

                ${featureRowsHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">${featureRowsHtml}</table>` : ''}

                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 36px;border-top:1px solid #EAECEE;background-color:#FBFBFA;border-radius:0 0 20px 20px;">
                <p style="margin:0;color:#94A3B8;font-size:12px;line-height:1.6;">${content.footerNoteHtml}</p>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 0;color:#94A3B8;font-size:11.5px;">HubertApp &middot; Votre compagnon de voyage</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
