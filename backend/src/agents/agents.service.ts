import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const agents = await this.prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'AGENT'],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: [
        {
          name: 'asc',
        },
        {
          email: 'asc',
        },
      ],
    });

    return agents;
  }
}
