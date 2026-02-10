import { IsString, IsUUID, Length } from 'class-validator';

export class ConversationJoinDto {
  @IsUUID()
  conversationId: string;
}

export class ConversationActionDto {
  @IsUUID()
  conversationId: string;
}

export class MessageSendDto {
  @IsUUID()
  conversationId: string;

  @IsString()
  @Length(1, 4000)
  body: string;
}

