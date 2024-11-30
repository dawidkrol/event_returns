import express, { Application } from 'express';
import router from './routes/router';
import errorHandling from './utils/errorHandler';

const app: Application = express();

app.use(express.json({ limit: '10kb' }));

app.use('/api', router);

app.use(errorHandling);

export default app;
