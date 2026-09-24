import { GraphQLClient } from 'graphql-request';
import { UserLookupService } from './user-lookup.service';

jest.mock('graphql-request', () => {
  const actual = jest.requireActual('graphql-request');
  return {
    ...actual,
    GraphQLClient: jest.fn(),
  };
});

describe('UserLookupService', () => {
  let service: UserLookupService;
  let mockRequest: jest.Mock;

  beforeEach(() => {
    mockRequest = jest.fn();
    (GraphQLClient as unknown as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));
    service = new UserLookupService();
  });

  it('shouldReturnTheEmailWhenMsUserRespondsSuccessfully', async () => {
    mockRequest.mockResolvedValue({ findOne: { email: 'user@example.com' } });

    const email = await service.getEmailForUser('user-123');

    expect(email).toBe('user@example.com');
    expect(mockRequest).toHaveBeenCalledWith(
      expect.anything(),
      { googleId: 'user-123' },
    );
  });

  it('shouldReturnUndefinedWithoutThrowingWhenMsUserIsUnreachable', async () => {
    mockRequest.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const email = await service.getEmailForUser('user-123');

    expect(email).toBeUndefined();
  });

  it('shouldReturnUndefinedWhenUserHasNoEmailOnRecord', async () => {
    mockRequest.mockResolvedValue({ findOne: { email: undefined } });

    const email = await service.getEmailForUser('user-123');

    expect(email).toBeUndefined();
  });

  it('shouldReturnDisabledChannelsAlongsideTheEmail', async () => {
    mockRequest.mockResolvedValue({
      findOne: { email: 'user@example.com', notificationChannelsDisabled: ['EMAIL'] },
    });

    const info = await service.getRecipientInfo('user-123');

    expect(info).toEqual({ email: 'user@example.com', disabledChannels: ['EMAIL'] });
  });

  it('shouldDefaultDisabledChannelsToAnEmptyArrayWhenAbsent', async () => {
    mockRequest.mockResolvedValue({ findOne: { email: 'user@example.com' } });

    const info = await service.getRecipientInfo('user-123');

    expect(info?.disabledChannels).toEqual([]);
  });
});
