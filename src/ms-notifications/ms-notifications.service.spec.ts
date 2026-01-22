import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './ms-notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  // Test 1 : La création
  it('shouldCreateNotificationWithDefaultStatus', () => {
    // ARRANGE
    const userId = 'user-123';
    const content = 'Hello World';

    // ACT
    const result = service.create(userId, content);

    // ASSERT
    expect(result).toBeDefined();
    expect(result.id).toBeDefined(); // L'UUID est généré
    expect(result.content).toBe(content);
    expect(result.isRead).toBe(false); // Règle métier par défaut
    
    expect(service.findAll()).toHaveLength(1);
  });

  // Test 2 : Le filtrage par utilisateur
  it('shouldReturnOnlyNotificationsForSpecificUser', () => {
    // ARRANGE : On peuple le service avec des données mixtes
    service.create('user-A', 'Notif A1');
    service.create('user-B', 'Notif B1');
    service.create('user-A', 'Notif A2');

    // ACT
    const userANotifications = service.findForUser('user-A');

    // ASSERT
    expect(userANotifications).toHaveLength(2);
    // On vérifie qu'on a pas récupéré accidentellement celle de user-B
    const hasUserB = userANotifications.some(n => n.userId === 'user-B');
    expect(hasUserB).toBe(false);
  });
});