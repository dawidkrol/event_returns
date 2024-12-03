import { Router } from 'express';
import { helloWorld } from '~/controllers/mainController';
import { createEvent } from '~/controllers/createEvent';
import { addParticipant } from '~/controllers/addParticipant';
import { getParticipant } from '~/controllers/getParticipants';

const router = Router();

router.route('/hello-world').get(helloWorld);
router.route('/events').post(createEvent);
router.route('/:eventId/people').post(addParticipant);
router.route('/:eventId/people').get(getParticipant);

export default router;
