import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { getRoadByUserId } from '~/repositories/road.repository';
import { checkIfRequestAndDriverAreConnected, checkIfRequestExists } from '~/validators/roadDecision.validator';
import { checkIfDriverExists } from '~/validators/driver.validator';
import { deleteRouteProposition, moveRoadFromTemporaryToFinal } from '~/repositories/tempRoad.repository';
import { removePassengersFromSeats } from '~/repositories/driver.repository';

export const roadDecision = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { requestId } = req.params;
    const driverId = req.headers['driverid'];
    const { decision } = req.body;

    if(!requestId) { 
        return res.status(400).json({ error: 'requestId is required' });
    }

    if(!driverId) {
        return res.status(400).json({ error: 'header driverId is required' });
    }
    if(typeof driverId !== 'string') {
        return res.status(400).json({ error: 'header driverId must be a string' });
    }

    console.log(`DriverId: ${driverId}, RequestId: ${requestId}, Decision: ${decision}`);

    const { exists: isDriverExists, error: driverExistsError } = await checkIfDriverExists(driverId);
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

    var { connected: isDriverConnected, error: driverConnectedError } = await checkIfRequestAndDriverAreConnected(requestId, driverId);
    if(driverConnectedError) {
        return res.status(500).json({ driverConnectedError });
    }
    if(!isDriverConnected) {
        return res.status(401).json({ error: `Driver: ${driverId} and Request: ${requestId} are not connected` });
    }

    if(decision === 'accept') {
        await moveRoadFromTemporaryToFinal(requestId);
    } else if (decision === 'reject') {
        await removePassengersFromSeats(driverId, 1);
        await deleteRouteProposition(requestId);
    }

    return res.status(200).json({});
});
