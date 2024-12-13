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
const wsServer = ws.startWS().listen(wsPort, () => {
    console.log(`WebSocket listening on port ${wsPort}!`);
});

const apiPort = process.env.PORT || 3000;
const apiServer: Server = app.listen(apiPort, () => {
    console.log(`API listening on port ${apiPort}!`);
});

process.on('unhandledRejection', (err: Error) => {
    console.error('Unhandled Promise Rejection -- server shutdown');
    console.error(err.name, err.message);
    apiServer.close(() => {
        process.exit(1);
    });
    wsServer.close(() => {
        process.exit(1);
    });
});
