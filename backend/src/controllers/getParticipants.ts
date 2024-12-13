import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { getPeopleByEventId } from '~/repositories/user.repository';

export const getParticipant = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { eventId } = req.params;
    if(!eventId) { 
        return res.status(400).json({ error: 'eventId is required' });
    }

    const { people, error } = await getPeopleByEventId(eventId);
    if(error) {
        return res.status(500).json({ error });
    }

    return res.status(200).json({ participants: people });
});
