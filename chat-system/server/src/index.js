require('dotenv').config({ override: true });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const path = require('path');
const healthRouter = require('./routes/health');
const chatRouter = require('./routes/chat');
const guestHandler = require('./socket/guestHandler');
const managerHandler = require('./socket/managerHandler');

const fs = require('fs');
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
const widgetPath1 = path.join(__dirname, '../../widget');
const widgetPath2 = path.join(__dirname, '../widget');
const widgetDir = fs.existsSync(widgetPath1) ? widgetPath1 : widgetPath2;
console.log(`[Widget] serving from: ${widgetDir} (exists: ${fs.existsSync(widgetDir)})`);
app.use('/widget', express.static(widgetDir, {
  setHeaders: (res, filePath) => {
    // 위젯 JS/CSS는 브라우저가 매번 서버에 변경 확인 (304/200)
    // → 손님 폰에서 옛 버전 캐시 문제 방지
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

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
