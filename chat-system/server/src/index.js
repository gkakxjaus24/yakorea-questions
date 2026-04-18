require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const path = require('path');
const healthRouter = require('./routes/health');
const chatRouter = require('./routes/chat');
const guestHandler = require('./socket/guestHandler');
const managerHandler = require('./socket/managerHandler');

const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', healthRouter);
app.use('/api/chat', chatRouter);
app.use('/widget', express.static(path.join(__dirname, '../../widget')));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
});

io.on('connection', (socket) => {
  console.log(`[Socket] connected: ${socket.id}`);
  guestHandler(io, socket);
  managerHandler(io, socket);
  socket.on('disconnect', () => {
    console.log(`[Socket] disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io, httpServer };
