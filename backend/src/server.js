import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] }
});

const onlineUsers = new Map();

function sign(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'ChatSphere API' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6)
      return res.status(400).json({ message: 'Name, email and a 6+ character password are required.' });
    const normalized = email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: normalized } });
    if (exists) return res.status(409).json({ message: 'An account with this email already exists.' });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name: name.trim(), email: normalized, password: hash } });
    res.status(201).json({ token: sign(user), user: safeUser(user) });
  } catch {
    res.status(500).json({ message: 'Unable to create account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email?.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(password || '', user.password)))
      return res.status(401).json({ message: 'Incorrect email or password.' });
    res.json({ token: sign(user), user: safeUser(user) });
  } catch {
    res.status(500).json({ message: 'Unable to log in.' });
  }
});

app.get('/api/users', auth, async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
  res.json(users.filter(u => u.id !== req.user.id).map(safeUser));
});

app.get('/api/messages/:userId', auth, async (req, res) => {
  const other = req.params.userId;
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: req.user.id, receiverId: other },
        { senderId: other, receiverId: req.user.id }
      ]
    },
    orderBy: { createdAt: 'asc' },
    include: { sender: true, receiver: true }
  });
  res.json(messages.map(m => ({
    id: m.id,
    senderId: m.senderId,
    receiverId: m.receiverId,
    content: m.content,
    createdAt: m.createdAt,
    sender: safeUser(m.sender),
    receiver: safeUser(m.receiver)
  })));
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid socket token'));
  }
});

io.on('connection', socket => {
  const userId = socket.user.id;
  onlineUsers.set(userId, socket.id);
  io.emit('presence:update', { userId, online: true });

  socket.on('room:join', ({ roomId }) => {
    if (roomId) socket.join(roomId);
  });

  socket.on('message:send', async ({ receiverId, content }) => {
    const clean = String(content || '').trim();
    if (!receiverId || !clean) return;
    const message = await prisma.message.create({
      data: { senderId: userId, receiverId, content: clean },
      include: { sender: true, receiver: true }
    });
    const notification = await prisma.notification.create({
  data: {
    userId: receiverId,
    type: 'message',
    title: `New message from ${message.sender.name}`,
    message: message.content,
    relatedId: message.id
  }
});
    const payload = {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      createdAt: message.createdAt,
      sender: safeUser(message.sender),
      receiver: safeUser(message.receiver)
    };
    const roomId = [userId, receiverId].sort().join(':');
    io.to(roomId).emit('message:new', payload);
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) io.to(receiverSocket).emit('message:new', payload);
  });

  socket.on('typing:start', ({ receiverId }) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) io.to(receiverSocket).emit('typing:update', { userId, typing: true });
  });

  socket.on('typing:stop', ({ receiverId }) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) io.to(receiverSocket).emit('typing:update', { userId, typing: false });
  });

  socket.on('disconnect', () => {
    if (onlineUsers.get(userId) === socket.id) {
      onlineUsers.delete(userId);
      io.emit('presence:update', { userId, online: false });
    }
  });
});

server.listen(PORT, () => console.log(`ChatSphere API running at http://localhost:${PORT}`));
