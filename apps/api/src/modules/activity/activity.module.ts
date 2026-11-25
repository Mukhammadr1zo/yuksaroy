import { Module } from '@nestjs/common';
import { BotActivityController } from './bot-activity.controller';

// ActivityService o'zi CommonModule (global) da: AuditService unga tayanadi.
@Module({ controllers: [BotActivityController] })
export class ActivityModule {}
