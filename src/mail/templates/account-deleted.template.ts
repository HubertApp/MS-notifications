import {
  EmailTemplate,
  EmailTemplateContent,
} from './email-template.interface';

// Confirmation envoyée après suppression effective du compte. Ne dépend d'aucune donnée du contexte, d'où l'absence de paramètre ici.
export const accountDeletedEmailTemplate: EmailTemplate = {
  subject: 'Votre compte HubertApp a bien été supprimé',

  build(): EmailTemplateContent {
    return {
      heading: 'Compte supprimé',
      bodyHtml:
        "Votre compte HubertApp et l'ensemble de vos données personnelles ont été définitivement supprimés, comme demandé. Cette action est irréversible.",
      footerNoteHtml:
        "Vous recevez cet e-mail car une suppression de compte HubertApp associée à cette adresse vient d'avoir lieu. Si vous n'êtes pas à l'origine de cette action, contactez-nous au plus vite.",
    };
  },
};
