import { Router } from 'express';
import { helloWorld } from '~/controllers/mainController';
import { createEvent } from '~/controllers/createEvent';
import { addParticipant } from '~/controllers/addParticipant';
import { getParticipant } from '~/controllers/getParticipants';

const router = Router();

router.route('/hello-world').get(helloWorld);
router.route('/create-event').post(createEvent);
router.route('/:eventId/add-participant').post(addParticipant);
router.route('/:eventId/get-participants').get(getParticipant);

export default router;
