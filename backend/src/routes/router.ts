import { Router } from 'express';
import { helloWorld } from '~/controllers/mainController';
import { createEvent } from '~/controllers/createEvent';

const router = Router();

router.route('/hello-world').get(helloWorld);
router.route('/create-event').get(createEvent);

export default router;
