export type Customer = {
  id: string;
  name?: string | null;
  email?: string | null;
  externalId?: string | null;
};

export type Inbox = {
  id: string;
  name: string;
};

export type TicketSummary = {
  id: string;
  status: string;
  priority: string;
};

export type ConversationListItem = {
  id: string;
  status: string;
  assignedAgentId?: string | null;
  lastMessageAt?: string | null;
  lastCustomerMessageAt?: string | null;
  lastAgentMessageAt?: string | null;
  needsAttention: boolean;
  customer: Customer;
  inbox: Inbox;
  ticket?: TicketSummary | null;
};

export type ConversationListResponse = {
  items: ConversationListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type Message = {
  id: string;
  conversationId: string;
  senderType: 'CUSTOMER' | 'AGENT' | 'SYSTEM';
  senderUserId?: string | null;
  senderCustomerId?: string | null;
  body: string;
  createdAt: string;
};

export type ConversationDetail = ConversationListItem & {
  needsAttention: boolean;
};

export type ConversationDetailResponse = {
  conversation: ConversationDetail;
  messages: Message[];
};

export type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: 'LOW' | 'MED' | 'HIGH';
};

export type TicketListItem = {
  id: string;
  title: string;
  status: string;
  priority: 'LOW' | 'MED' | 'HIGH';
  conversationId: string;
  assignedAgentId?: string | null;
  createdByAgentId?: string | null;
  updatedAt: string;
  createdAt: string;
  conversation: {
    id: string;
    customer: Customer;
    inbox: Inbox;
  };
};

export type TicketListResponse = {
  items: TicketListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type TicketDetail = TicketListItem & {};
