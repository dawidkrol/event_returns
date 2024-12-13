import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { getRoadByUserId } from '~/repositories/road.repository';
import { checkIfUserExists } from '~/services/user.service';

export const getRoad = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { userId } = req.params;
    if(!userId) { 
        return res.status(400).json({ error: 'userId is required' });
    }

    const { error } = await checkIfUserExists(userId);
    if(error) {
        return res.status(500).json({ error });
    }

    const { road, error: roadNotFoundError } = await getRoadByUserId(userId);
    if (roadNotFoundError) {
        return res.status(404).json({ error: "Road not found" });
    }

    return res.status(200).json({ road });
});
