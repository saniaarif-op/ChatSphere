# ChatSphere — EncoderX Week 04

A full-stack real-time chat application built for EncoderX Remote Internship Batch 02, Week 04.

## Features
- React + Vite frontend
- Node.js + Express backend
- Socket.IO real-time communication
- JWT authentication
- SQLite persistence with Prisma
- Private chat rooms
- Online/offline presence
- Typing indicators
- Persistent chat history
- Responsive interactive UI
- Smooth CSS animations

## Project Structure
- `frontend/` — React/Vite application
- `backend/` — Express + Socket.IO API
- `docs/` — architecture and pipeline notes

## Run
Open two terminals.

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open the frontend URL shown by Vite.

## Demo accounts
Register two accounts from the Register screen. Open the app in two browser windows and log in as different users to test real-time messaging.

## EncoderX requirements covered
WebSocket architecture, authentication handshake, rooms, persistent messages, sender/receiver/timestamps, live UI refresh, online/offline state, typing indicators, GitHub-ready source structure and documentation.
