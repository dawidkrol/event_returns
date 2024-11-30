import { Router } from 'express';
import { helloWorld } from '../controllers/mainController';

const router = Router();

router.route('/hello-world').get(helloWorld);

export default router;
