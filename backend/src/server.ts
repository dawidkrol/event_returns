import dotenv from 'dotenv';
import { Server } from 'http';
import app from './app';
import { WebSocketServer } from './ws';

dotenv.config({ path: './.env' });

process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught Exception -- server shutdown');
  console.error(err.name, err.message);
  process.exit(1);
});

const wsPort = process.env.WS_PORT || 3001;
export const ws = new WebSocketServer()
ws.startWS().listen(wsPort, () => {
  console.log(`WebSocket listening on port ${wsPort}!`);
});

const port = process.env.PORT || 3000;
const server: Server = app.listen(port, () => {
  console.log(`API listening on port ${port}!`);
});

process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Promise Rejection -- server shutdown');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
