import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { validateDriver } from '~/validators/driver.validator';

export const setRoadDriver = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { userId } = req.params;
    if(!userId) { 
        return res.status(400).json({ error: 'userId is required' });
    }

    const { driverModel, error } = validateDriver(req);
    if (error) {
        return res.status(400).json({ error });
    }

    return res.status(201).json({ });
});