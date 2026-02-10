import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InboxesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.inbox.findMany({
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}

