import { Module } from '@nestjs/common';
import { TravelPlansController } from './travel-plans.controller';
import { TravelPlansService } from './travel-plans.service';

@Module({
  controllers: [TravelPlansController],
  providers: [TravelPlansService],
})
export class TravelPlansModule {}
