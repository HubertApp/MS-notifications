import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsResolver } from './ms-notifications.resolver';
import { NotificationsService } from './ms-notifications.service';

describe('NotificationsResolver', () => {
  let resolver: NotificationsResolver;
  let service: NotificationsService;

  // MOCK : On crée un faux service. 
  // On ne met que les méthodes utilisées par le Resolver.
  const mockNotificationsService = {
    findAll: jest.fn(() => ['mock-notif']), // Retourne une fausse donnée simple
    create: jest.fn((userId, content) => ({ 
      id: 'mock-id', 
      userId, 
      content 
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsResolver,
        {
          provide: NotificationsService, // Quand Nest demande le Service...
          useValue: mockNotificationsService, // ... on donne le Mock
        },
      ],
    }).compile();

    resolver = module.get<NotificationsResolver>(NotificationsResolver);
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('create', () => {
    it('shouldCallServiceCreateWithCorrectArguments', () => {
      // ARRANGE
      const userId = '123';
      const content = 'Test Content';

      // ACT
      const result = resolver.create(userId, content);

      // ASSERT
      // 1. On vérifie le retour
      expect(result).toEqual({ id: 'mock-id', userId, content });
      
      // 2. On vérifie que le "guichetier" a bien appelé le "cerveau"
      expect(service.create).toHaveBeenCalledWith(userId, content);
      expect(service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('shouldReturnArrayFromService', () => {
      // ACT
      const result = resolver.findAll();

      // ASSERT
      expect(result).toEqual(['mock-notif']);
      expect(service.findAll).toHaveBeenCalled();
    });
  });
});