import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { validateEvent } from '~/validators/event.validator';
import { createEvent as repoCreateEvent } from '~/repositories/event.repository';

export const createEvent = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { eventModel, error } = validateEvent(req);
    if (error) {
        return res.status(400).json({ error });
    }

    const{ error: databaseError, id } = await repoCreateEvent(eventModel!);
    if(databaseError) {
        return res.status(500).json({ error: databaseError });
    }

    return res.status(201).json({ eventId: id });
});