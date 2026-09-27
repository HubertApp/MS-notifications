import { getEmailTemplate } from './index';
import { welcomeEmailTemplate } from './welcome.template';
import { accountDeletedEmailTemplate } from './account-deleted.template';
import { genericEmailTemplate } from './generic.template';

describe('getEmailTemplate (registre type de notification -> template)', () => {
  it('should return the welcome template for WELCOME', () => {
    expect(getEmailTemplate('WELCOME')).toBe(welcomeEmailTemplate);
  });

  it('should return the account-deleted template for ACCOUNT_DELETED', () => {
    expect(getEmailTemplate('ACCOUNT_DELETED')).toBe(
      accountDeletedEmailTemplate,
    );
  });

  it('should fall back to the generic template for an unregistered type', () => {
    expect(getEmailTemplate('SOME_UNKNOWN_TYPE')).toBe(genericEmailTemplate);
  });

  it('should fall back to the generic template for an empty type', () => {
    expect(getEmailTemplate('')).toBe(genericEmailTemplate);
  });
});
