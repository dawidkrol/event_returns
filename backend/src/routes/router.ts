import { Router } from 'express';
import { helloWorld } from '~/controllers/mainController';
import { createEvent } from '~/controllers/createEvent';
import { addParticipant } from '~/controllers/addParticipant';

const router = Router();

router.route('/hello-world').get(helloWorld);
router.route('/create-event').get(createEvent);
router.route('/create-event/add-participant').get(addParticipant);

export default router;
