import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { checkIfUserExists } from '~/validators/user.validator';
import { getTempRoadByUserId } from '~/repositories/tempRoad.repository';

export const getTempRoad = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { userId } = req.params;
    if(!userId) { 
        return res.status(400).json({ error: 'userId is required' });
    }

    var { error } = await checkIfUserExists(userId);
    if(error) {
        return res.status(500).json({ error });
    }

    var { road, error: roadNotFoundError } = await getTempRoadByUserId(userId);
    if (roadNotFoundError) {
        return res.status(404).json({ error: "Road not found" });
    }

    return res.status(200).json({ road });
});
