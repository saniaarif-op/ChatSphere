# Real-Time Pipeline

1. User signs in and receives a JWT.
2. Frontend creates a Socket.IO connection with the JWT in `handshake.auth`.
3. Backend verifies the token in Socket.IO middleware.
4. Authenticated user is mapped to a socket ID.
5. Frontend joins a deterministic private room.
6. User submits a message.
7. Client emits `message:send`.
8. Server validates and saves the message through Prisma.
9. Server emits `message:new` to the conversation room/receiver.
10. Both clients append the message without a page refresh.
11. Typing events are emitted while the user types.
12. Connection and disconnection events update online/offline status.
