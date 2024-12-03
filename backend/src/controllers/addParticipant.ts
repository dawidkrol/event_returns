import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { createEvent as repoCreateEvent } from '~/repositories/event.repository';
import { validateUser } from '~/validators/user.validator';
import { addPerson } from '~/repositories/user.repository';

export const addParticipant = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { eventId } = req.query;
    console.log('req.params:', req.query);
    if(!eventId) { 
        return res.status(400).json({ error: 'eventId is required' });
    }

    const { userModel, error } = validateUser(req);
    if (error) {
        return res.status(400).json({ error });
    }

    const{ error: databaseError, id } = await addPerson(userModel!, eventId as string);
    if(databaseError) {
        return res.status(500).json({ error: databaseError });
    }

    return res.status(201).json({ personId: id });
});