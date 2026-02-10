import {
  PrismaClient,
  UserRole,
  ConversationStatus,
  MessageSenderType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Demo markers for easy identification
const DEMO_MARKERS = {
  UNASSIGNED: '[DEMO] Unassigned waiting',
  ASSIGNED: '[DEMO] Assigned active',
  CLOSED: '[DEMO] Closed resolved',
  TICKET_NEW: '[DEMO] Ticket: New',
  TICKET_OPEN: '[DEMO] Ticket: Open',
  TICKET_PENDING: '[DEMO] Ticket: Pending',
  TICKET_RESOLVED: '[DEMO] Ticket: Resolved',
};

async function main() {
  const adminEmail = 'admin@local.test';
  const adminPassword = 'Admin123!';

  const agentEmail = 'agent@local.test';
  const agentPassword = 'Agent123!';

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const agentPasswordHash = await bcrypt.hash(agentPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      name: 'Admin User',
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: agentEmail },
    update: {},
    create: {
      email: agentEmail,
      passwordHash: agentPasswordHash,
      role: UserRole.AGENT,
      name: 'Agent User',
    },
  });

  const inbox = await prisma.inbox.upsert({
    where: { name: 'Default' },
    update: {},
    create: {
      name: 'Default',
    },
  });

  // Create customers for different scenarios
  const customer1 = await prisma.customer.upsert({
    where: { externalId: 'demo-customer-unassigned' },
    update: {},
    create: {
      externalId: 'demo-customer-unassigned',
      email: 'unassigned@example.test',
      name: 'Unassigned Customer',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { externalId: 'demo-customer-assigned' },
    update: {},
    create: {
      externalId: 'demo-customer-assigned',
      email: 'assigned@example.test',
      name: 'Assigned Customer',
    },
  });

  const customer3 = await prisma.customer.upsert({
    where: { externalId: 'demo-customer-closed' },
    update: {},
    create: {
      externalId: 'demo-customer-closed',
      email: 'closed@example.test',
      name: 'Closed Customer',
    },
  });

  // Scenario A: Unassigned OPEN conversation with latest message from CUSTOMER (needs attention)
  let unassignedConvo = await prisma.conversation.findFirst({
    where: {
      inboxId: inbox.id,
      customerId: customer1.id,
      status: ConversationStatus.OPEN,
    },
  });

  if (!unassignedConvo) {
    unassignedConvo = await prisma.conversation.create({
      data: {
        inboxId: inbox.id,
        customerId: customer1.id,
        status: ConversationStatus.OPEN,
        assignedAgentId: null,
        assignedAt: null,
      },
    });
  } else {
    // Update to ensure it's unassigned
    unassignedConvo = await prisma.conversation.update({
      where: { id: unassignedConvo.id },
      data: {
        status: ConversationStatus.OPEN,
        assignedAgentId: null,
        assignedAt: null,
      },
    });
  }

  // Ensure unassigned conversation has customer message as latest (needs attention)
  const unassignedMessages = await prisma.message.findMany({
    where: { conversationId: unassignedConvo.id },
  });

  if (unassignedMessages.length === 0 || !unassignedMessages.some((m) => m.body.includes(DEMO_MARKERS.UNASSIGNED))) {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    await prisma.message.createMany({
      data: [
        {
          conversationId: unassignedConvo.id,
          senderType: MessageSenderType.CUSTOMER,
          senderCustomerId: customer1.id,
          body: `${DEMO_MARKERS.UNASSIGNED}: I need help with my order.`,
          createdAt: fiveMinutesAgo,
        },
        {
          conversationId: unassignedConvo.id,
          senderType: MessageSenderType.CUSTOMER,
          senderCustomerId: customer1.id,
          body: 'This conversation is unassigned and needs attention.',
          createdAt: now, // Latest message from customer
        },
      ],
      skipDuplicates: true,
    });

    await prisma.conversation.update({
      where: { id: unassignedConvo.id },
      data: {
        lastMessageAt: now,
        lastCustomerMessageAt: now,
        lastAgentMessageAt: null,
      },
    });
  }

  // Create event log marker for this conversation (if not exists)
  const existingUnassignedLog = await prisma.eventLog.findFirst({
    where: {
      type: 'conversation.created',
      conversationId: unassignedConvo.id,
      metadata: { path: ['demoTag'], equals: 'unassigned' },
    },
  });

  if (!existingUnassignedLog) {
    await prisma.eventLog.create({
      data: {
        type: 'conversation.created',
        conversationId: unassignedConvo.id,
        actorUserId: null,
        metadata: { demoTag: 'unassigned' },
      },
    });
  }

  // Scenario B: Assigned OPEN conversation with recent AGENT reply (no attention needed)
  let assignedConvo = await prisma.conversation.findFirst({
    where: {
      inboxId: inbox.id,
      customerId: customer2.id,
      status: ConversationStatus.OPEN,
    },
  });

  if (!assignedConvo) {
    assignedConvo = await prisma.conversation.create({
      data: {
        inboxId: inbox.id,
        customerId: customer2.id,
        status: ConversationStatus.OPEN,
        assignedAgentId: agent.id,
        assignedAt: new Date(),
      },
    });
  } else {
    assignedConvo = await prisma.conversation.update({
      where: { id: assignedConvo.id },
      data: {
        status: ConversationStatus.OPEN,
        assignedAgentId: agent.id,
        assignedAt: new Date(),
      },
    });
  }

  const assignedMessages = await prisma.message.findMany({
    where: { conversationId: assignedConvo.id },
  });

  if (assignedMessages.length === 0 || !assignedMessages.some((m) => m.body.includes(DEMO_MARKERS.ASSIGNED))) {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);

    await prisma.message.createMany({
      data: [
        {
          conversationId: assignedConvo.id,
          senderType: MessageSenderType.CUSTOMER,
          senderCustomerId: customer2.id,
          body: `${DEMO_MARKERS.ASSIGNED}: Hello, I have a question.`,
          createdAt: tenMinutesAgo,
        },
        {
          conversationId: assignedConvo.id,
          senderType: MessageSenderType.AGENT,
          senderUserId: agent.id,
          body: 'Hi! How can I help you today?',
          createdAt: new Date(tenMinutesAgo.getTime() + 2 * 60 * 1000),
        },
        {
          conversationId: assignedConvo.id,
          senderType: MessageSenderType.AGENT,
          senderUserId: agent.id,
          body: 'This conversation is assigned and has a recent agent reply.',
          createdAt: oneMinuteAgo, // Latest message from agent
        },
      ],
      skipDuplicates: true,
    });

    await prisma.conversation.update({
      where: { id: assignedConvo.id },
      data: {
        lastMessageAt: oneMinuteAgo,
        lastAgentMessageAt: oneMinuteAgo,
        lastCustomerMessageAt: tenMinutesAgo,
      },
    });
  }

  const existingAssignedLog = await prisma.eventLog.findFirst({
    where: {
      type: 'conversation.created',
      conversationId: assignedConvo.id,
      metadata: { path: ['demoTag'], equals: 'assigned' },
    },
  });

  if (!existingAssignedLog) {
    await prisma.eventLog.create({
      data: {
        type: 'conversation.created',
        conversationId: assignedConvo.id,
        actorUserId: null,
        metadata: { demoTag: 'assigned' },
      },
    });
  }

  // Scenario C: CLOSED conversation
  let closedConvo = await prisma.conversation.findFirst({
    where: {
      inboxId: inbox.id,
      customerId: customer3.id,
      status: ConversationStatus.CLOSED,
    },
  });

  if (!closedConvo) {
    closedConvo = await prisma.conversation.create({
      data: {
        inboxId: inbox.id,
        customerId: customer3.id,
        status: ConversationStatus.CLOSED,
        assignedAgentId: agent.id,
        assignedAt: new Date(),
      },
    });
  } else {
    closedConvo = await prisma.conversation.update({
      where: { id: closedConvo.id },
      data: {
        status: ConversationStatus.CLOSED,
        assignedAgentId: agent.id,
      },
    });
  }

  const closedMessages = await prisma.message.findMany({
    where: { conversationId: closedConvo.id },
  });

  if (closedMessages.length === 0 || !closedMessages.some((m) => m.body.includes(DEMO_MARKERS.CLOSED))) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    await prisma.message.createMany({
      data: [
        {
          conversationId: closedConvo.id,
          senderType: MessageSenderType.CUSTOMER,
          senderCustomerId: customer3.id,
          body: `${DEMO_MARKERS.CLOSED}: I had an issue but it's resolved now.`,
          createdAt: oneHourAgo,
        },
        {
          conversationId: closedConvo.id,
          senderType: MessageSenderType.AGENT,
          senderUserId: agent.id,
          body: 'Great! This conversation is closed.',
          createdAt: new Date(oneHourAgo.getTime() + 5 * 60 * 1000),
        },
      ],
      skipDuplicates: true,
    });
  }

  const existingClosedLog = await prisma.eventLog.findFirst({
    where: {
      type: 'conversation.created',
      conversationId: closedConvo.id,
      metadata: { path: ['demoTag'], equals: 'closed' },
    },
  });

  if (!existingClosedLog) {
    await prisma.eventLog.create({
      data: {
        type: 'conversation.created',
        conversationId: closedConvo.id,
        actorUserId: null,
        metadata: { demoTag: 'closed' },
      },
    });
  }

  // Scenario D: Tickets in each status
  // Ticket 1: NEW
  const ticketNew = await prisma.ticket.upsert({
    where: { conversationId: unassignedConvo.id },
    update: {
      status: TicketStatus.NEW,
      title: DEMO_MARKERS.TICKET_NEW,
    },
    create: {
      conversationId: unassignedConvo.id,
      status: TicketStatus.NEW,
      priority: TicketPriority.MED,
      title: DEMO_MARKERS.TICKET_NEW,
      createdByAgentId: admin.id,
      assignedAgentId: null,
    },
  });

  // Ticket 2: OPEN (create a new conversation for this)
  const ticketOpenConvo = await prisma.conversation.create({
    data: {
      inboxId: inbox.id,
      customerId: customer1.id,
      status: ConversationStatus.OPEN,
      assignedAgentId: agent.id,
    },
  });

  const ticketOpen = await prisma.ticket.upsert({
    where: { conversationId: ticketOpenConvo.id },
    update: {
      status: TicketStatus.OPEN,
      title: DEMO_MARKERS.TICKET_OPEN,
    },
    create: {
      conversationId: ticketOpenConvo.id,
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      title: DEMO_MARKERS.TICKET_OPEN,
      createdByAgentId: agent.id,
      assignedAgentId: agent.id,
    },
  });

  // Ticket 3: PENDING
  const ticketPendingConvo = await prisma.conversation.create({
    data: {
      inboxId: inbox.id,
      customerId: customer2.id,
      status: ConversationStatus.OPEN,
      assignedAgentId: agent.id,
    },
  });

  const ticketPending = await prisma.ticket.upsert({
    where: { conversationId: ticketPendingConvo.id },
    update: {
      status: TicketStatus.PENDING,
      title: DEMO_MARKERS.TICKET_PENDING,
    },
    create: {
      conversationId: ticketPendingConvo.id,
      status: TicketStatus.PENDING,
      priority: TicketPriority.LOW,
      title: DEMO_MARKERS.TICKET_PENDING,
      createdByAgentId: agent.id,
      assignedAgentId: agent.id,
    },
  });

  // Ticket 4: RESOLVED
  const ticketResolvedConvo = await prisma.conversation.create({
    data: {
      inboxId: inbox.id,
      customerId: customer3.id,
      status: ConversationStatus.CLOSED,
      assignedAgentId: agent.id,
    },
  });

  const ticketResolved = await prisma.ticket.upsert({
    where: { conversationId: ticketResolvedConvo.id },
    update: {
      status: TicketStatus.RESOLVED,
      title: DEMO_MARKERS.TICKET_RESOLVED,
    },
    create: {
      conversationId: ticketResolvedConvo.id,
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.MED,
      title: DEMO_MARKERS.TICKET_RESOLVED,
      createdByAgentId: agent.id,
      assignedAgentId: agent.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seed data created successfully.');
  // eslint-disable-next-line no-console
  console.log('\n📋 Demo Credentials:');
  // eslint-disable-next-line no-console
  console.log(`  Admin: ${adminEmail} / ${adminPassword}`);
  // eslint-disable-next-line no-console
  console.log(`  Agent: ${agentEmail} / ${agentPassword}`);
  // eslint-disable-next-line no-console
  console.log('\n🔗 Useful URLs:');
  // eslint-disable-next-line no-console
  console.log('  Frontend:     http://localhost:5173');
  // eslint-disable-next-line no-console
  console.log('  API base:     http://localhost:3000/api');
  // eslint-disable-next-line no-console
  console.log('  Swagger docs: http://localhost:3000/api/docs');
  // eslint-disable-next-line no-console
  console.log('\n📊 Demo Scenarios Created:');
  // eslint-disable-next-line no-console
  console.log(`  ✅ Unassigned conversation (needs attention): ${unassignedConvo.id}`);
  // eslint-disable-next-line no-console
  console.log(`  ✅ Assigned conversation (active): ${assignedConvo.id}`);
  // eslint-disable-next-line no-console
  console.log(`  ✅ Closed conversation: ${closedConvo.id}`);
  // eslint-disable-next-line no-console
  console.log(`  ✅ Tickets: NEW, OPEN, PENDING, RESOLVED`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
