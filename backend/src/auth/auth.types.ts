export type AuthUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  name: string;
};

