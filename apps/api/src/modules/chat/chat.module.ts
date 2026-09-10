import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({ imports: [IdentityModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
