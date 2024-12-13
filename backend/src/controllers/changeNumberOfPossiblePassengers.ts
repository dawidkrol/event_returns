import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { changeNumberOfPossiblePassengers, checkIfDriverExists } from '~/services/driver.service';

export const changeDriversNumberOfPossiblePassengers = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { driverId } = req.params;
    const { newNumberOfPossiblePassengers } = req.body;

    if(!newNumberOfPossiblePassengers) {
        return res.status(400).json({ error: 'newNumberOfPossiblePassengers is required' });
    }

    if(!driverId) { 
        return res.status(400).json({ error: 'userId is required' });
    }
    
    const { exists: isDriverExists, error: driverExistsError } = await checkIfDriverExists(driverId);
    if(driverExistsError) {
        return res.status(500).json({ error: driverExistsError });
    }
    if(!isDriverExists) {
        return res.status(404).json({ error: `Driver: ${driverId} not found` });
    }

    const { error } = await changeNumberOfPossiblePassengers(driverId, newNumberOfPossiblePassengers);
    console.log(error);
    if(error != null) {
        return res.status(500).json({ error });
    }

    return res.status(200).json({});
});