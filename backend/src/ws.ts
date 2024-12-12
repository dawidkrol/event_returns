import WebSocket from 'ws';
import * as http from 'http';

export class WebSocketServer {
public clients = new Map<string, WebSocket>();

public sendMessageToClient(clientId: string, message: string) {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
        console.log(`Sending message to client with ID: ${clientId}`);
        client.send(message);
    } else {
        console.log(`Client with ID ${clientId} not found`);
    }
}

public startWS(): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> {
    const server = http.createServer();
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws: WebSocket) => {
        ws.on('message', (message: string) => {
            const clientId = message.toString();
            if (clientId) {
                this.clients.set(clientId, ws);
                console.log(`Client with ID ${clientId} connected`);
            }
        });

        ws.on('close', () => {
            this.clients.forEach((client, clientId) => {
                if (client === ws) {
                    this.clients.delete(clientId);
                    console.log(`Client with ID ${clientId} disconnected`);
                }
            });
        });
    })
    return server;
}
}
