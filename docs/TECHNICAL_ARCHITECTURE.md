# Technical Architecture Summary

## Client
React + Vite provides the responsive chat interface. Socket.IO Client maintains a persistent connection to the server.

## Server
Node.js + Express provides authentication and REST endpoints. Socket.IO manages WebSocket-style real-time events.

## Authentication
JWT is issued during login/register. The same token is supplied in the Socket.IO handshake and verified by server middleware before the connection is accepted.

## Persistence
Prisma + SQLite stores users and messages. Each message contains sender, receiver, content and timestamp.

## Real-Time Events
- `room:join`
- `message:send`
- `message:new`
- `typing:start`
- `typing:stop`
- `typing:update`
- `presence:update`

## Room Model
A private room ID is generated from the two user IDs in sorted order. This keeps a conversation isolated between two users.
