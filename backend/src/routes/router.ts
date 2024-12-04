import { Router } from 'express';
import { createEvent } from '~/controllers/createEvent';
import { addParticipant } from '~/controllers/addParticipant';
import { getParticipant } from '~/controllers/getParticipants';
import { setRoadDriver } from '~/controllers/setRoad.driver';

const router = Router();

router.route('/events').post(createEvent);
router.route('/:eventId/people').post(addParticipant);
router.route('/:eventId/people').get(getParticipant);
router.route('/road/:userId/driver').post(setRoadDriver);

export default router;
