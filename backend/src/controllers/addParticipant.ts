import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { validateUser } from '~/validators/user.validator';
import { addPerson } from '~/repositories/user.repository';
import { checkIfEventExists } from '~/validators/event.validator';

export const addParticipant = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { eventId } = req.params;
    if(!eventId) { 
        return res.status(400).json({ error: 'eventId is required' });
    }

    const { userModel, error } = validateUser(req);
    if (error) {
        return res.status(400).json({ error });
    }

    const { error: eventNotExistError } = await checkIfEventExists(eventId as string);
    if(eventNotExistError) {
        return res.status(404).json({ error: "Event not found" });
    }

    const{ error: databaseError, id } = await addPerson(userModel!, eventId as string);
    if(databaseError) {
        return res.status(500).json({ error: databaseError });
    }

    return res.status(201).json({ personId: id });
});