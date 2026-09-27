import {
  EmailTemplate,
  EmailTemplateContent,
  EmailTemplateContext,
} from './email-template.interface';

export const welcomeEmailTemplate: EmailTemplate = {
  subject: 'Bienvenue sur HubertApp',

  build({
    frontUrl,
    unsubscribeUrl,
  }: EmailTemplateContext): EmailTemplateContent {
    return {
      heading: 'Bienvenue sur HubertApp',
      bodyHtml:
        "Votre compte vient d'être créé. HubertApp vous accompagne au quotidien pour vos déplacements.",
      featureRows: [
        {
          badge: '&#8594;',
          label:
            'Planifiez vos trajets multi-étapes, tous modes de transport confondus',
        },
        {
          badge: '&#9679;',
          label: "Suivez l'info trafic en temps réel sur vos lignes favorites",
        },
        {
          badge: '&#9733;',
          label: 'Retrouvez vos itinéraires et arrêts favoris en un instant',
        },
      ],
      cta: { label: 'Ouvrir HubertApp', url: frontUrl },
      footerNoteHtml: `Vous recevez cet e-mail suite à la création de votre compte HubertApp. <a href="${unsubscribeUrl}" style="color:#5B6B7A;text-decoration:underline;">Se désabonner des e-mails</a>`,
    };
  },
};
