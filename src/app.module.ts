// src/app.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from './ms-notifications/ms-notifications.module';

@Module({
  imports: [
    // Playground/introspection désactivés en prod.
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typePaths: ['./**/*.graphql'],
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
    }),
    // Persistance des notifications.
    MongooseModule.forRoot(
      process.env.MONGO_URL || 'mongodb://localhost:27017/hubertapp_notifications',
    ),
    NotificationsModule,
  ],
})
export class AppModule {}