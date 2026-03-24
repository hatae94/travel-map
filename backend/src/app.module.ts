import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlacesModule } from './places/places.module';
import { AuthModule } from './auth/auth.module';
import { TravelPlansModule } from './travel-plans/travel-plans.module';

@Module({
  imports: [PlacesModule, AuthModule, TravelPlansModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
