import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsResolver } from './ms-notifications.resolver';
import { NotificationsService } from './ms-notifications.service';

describe('NotificationsResolver', () => {
  let resolver: NotificationsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsResolver, NotificationsService],
    }).compile();

    resolver = module.get<NotificationsResolver>(NotificationsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
