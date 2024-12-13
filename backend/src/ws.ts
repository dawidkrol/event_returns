import WebSocket from 'ws';
import * as http from 'http';

export class WebSocketServer {
    public drivers = new Map<string, WebSocket>();
    public passengers = new Map<string, WebSocket>();

    public sendMessageToDriver(clientId: string, message: string) {
        const client = this.drivers.get(clientId);
        if (client && client.readyState === WebSocket.OPEN) {
            console.log(`Sending message to driver with ID: ${clientId}`);
            client.send(message);
        } else {
            console.log(`Driver with ID ${clientId} not found`);
        }
    }

    public sendMessageToPassenger(clientId: string, message: string) {
        const client = this.passengers.get(clientId);
        if (client && client.readyState === WebSocket.OPEN) {
            console.log(`Sending message to passenger with ID: ${clientId}`);
            client.send(message);
        } else {
            console.log(`Passenger with ID ${clientId} not found`);
        }
    }

    public startWS(): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> {
        const server = http.createServer();
        const wss = new WebSocket.Server({ server });

        wss.on('connection', (ws: WebSocket) => {
            ws.on('message', (message: string) => {
                try{
                    console.log('Received message:', message.toString());
                    const { userRole, userId } = JSON.parse(message.toString());
                    console.log(`User with ID ${userId} and role ${userRole} connected`);
                    if(userRole === 'driver') {
                        this.drivers.set(userId, ws);
                        console.log(`${JSON.stringify(this.drivers)} drivers connected`);
                        console.log(`Driver with ID ${userId} connected`);
                    }
                    if(userRole === 'passenger') {
                        this.passengers.set(userId, ws);
                        console.log(`${JSON.stringify(this.passengers)} passengers connected`);
                        console.log(`Passenger with ID ${userId} connected`);
                    }
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            ws.on('close', () => {
                try {
                    this.drivers.forEach((client, clientId) => {
                        if (client === ws) {
                            this.drivers.delete(clientId);
                            console.log(`Client with ID ${clientId} disconnected`);
                        }
                    });
                    this.passengers.forEach((client, clientId) => {
                        if (client === ws) {
                            this.passengers.delete(clientId);
                            console.log(`Client with ID ${clientId} disconnected`);
                        }
                    });
                } catch (error) {
                    console.error('Error closing connection:', error);
                }
            });
        })
        return server;
    }
}
