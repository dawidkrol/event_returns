import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { validateEvent } from '~/validators/event.validator';
import { createEvent as repoCreateEvent } from '~/repositories/event.repository';
import { addPerson } from '~/repositories/user.repository';

export const createEvent = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { eventModel, error } = validateEvent(req);
    if (error) {
        return res.status(400).json({ error });
    }

    const{ error: databaseError, id: eventId } = await repoCreateEvent(eventModel!);
    if(databaseError) {
        return res.status(500).json({ error: databaseError });
    }

    const{ error: userDatabaseError, id: userId } = await addPerson(eventModel!.organizer, eventId);
    if(databaseError) {
        return res.status(500).json({ error: userDatabaseError });
    }

    return res.status(201).json({ eventId: eventId, userId: userId });
});