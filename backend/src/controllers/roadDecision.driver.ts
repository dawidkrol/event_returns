import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { getRoadByUserId } from '~/repositories/road.repository';
import { checkIfRequestExists } from '~/validators/roadDecision.validator';
import { checkIfDriverExists } from '~/validators/driver.validator';

export const roadDecision = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { requestId, driverId } = req.params;
    if(!requestId) { 
        return res.status(400).json({ error: 'requestId is required' });
    }

    const { exists: isDriverExists, error: driverExistsError } = await checkIfDriverExists(requestId);
    if(driverExistsError) {
        return res.status(500).json({ error: driverExistsError });
    }
    if(!isDriverExists) {
        return res.status(404).json({ error: `Driver: ${driverId} not found` });
    }

    var { exists: isRequestExists, error: requestExistsError } = await checkIfRequestExists(requestId);
    if(requestExistsError) {
        return res.status(500).json({ requestExistsError });
    }
    if(!isRequestExists) {
        return res.status(404).json({ error: `Request: ${requestId} not found` });
    }

    // check if driver and request are connected
    //set temp to road

    var { road, error: roadNotFoundError } = await getRoadByUserId(driverId);
    if (roadNotFoundError) {
        return res.status(404).json({ error: "Road not found" });
    }

    return res.status(200).json({ road });
});
