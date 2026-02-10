import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    // TODO: Validate JWT access token once auth module is implemented.
    // This establishes the convention:
    // frontend: io(VITE_SOCKET_URL, { auth: { token: accessToken } })
    // backend:  socket.handshake.auth.token
    if (!token) {
      client.disconnect(true);
      return;
    }
  }

  handleDisconnect(client: Socket) {
    // Placeholder for disconnect handling
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() payload: any) {
    return { event: 'pong', data: payload };
  }
}

