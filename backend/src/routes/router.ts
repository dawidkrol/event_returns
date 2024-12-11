import { Router } from 'express';
import { createEvent } from '~/controllers/createEvent';
import { addParticipant } from '~/controllers/addParticipant';
import { getParticipant } from '~/controllers/getParticipants';
import { setRoadDriver } from '~/controllers/setRoad.driver';
import { getRoad } from '~/controllers/getRoad';
import { setRoadPassenger } from '~/controllers/setRoad.passenger';
import { getTempRoad } from '~/controllers/getTempRoad';

const router = Router();

router.route('/events').post(createEvent);
router.route('/:eventId/people').post(addParticipant);
router.route('/:eventId/people').get(getParticipant);
router.route('/road/:userId/driver').post(setRoadDriver);
router.route('/road/:userId/passenger').post(setRoadPassenger);
router.route('/road/:userId').get(getRoad);
router.route('/road/:userId/temp').get(getTempRoad);

export default router;
