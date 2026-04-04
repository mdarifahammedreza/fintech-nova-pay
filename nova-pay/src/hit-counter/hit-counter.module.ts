import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HitCounter } from './entities/hit-counter.entity';
import { HitCounterController } from './hit-counter.controller';
import { HitCounterService } from './hit-counter.service';

@Module({
  imports: [TypeOrmModule.forFeature([HitCounter])],
  controllers: [HitCounterController],
  providers: [HitCounterService],
})
export class HitCounterModule {}
