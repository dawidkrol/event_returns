import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { validateDriver } from '~/validators/driver.validator';
import { checkIfUserExists } from '~/validators/user.validator';

export const setRoadDriver = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { userId } = req.params;
    if(!userId) { 
        return res.status(400).json({ error: 'userId is required' });
    }

    const { driverModel, error: driverError } = validateDriver(req);
    if (driverError) {
        return res.status(400).json({ error: driverError });
    }

    const { error } = await checkIfUserExists(userId);
    if (error) {
        return res.status(404).json({ error: "User not found" });
    }

    return res.status(201).json({ });
});