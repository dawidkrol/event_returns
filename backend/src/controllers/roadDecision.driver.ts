import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { checkIfRequestAndDriverAreConnected, checkIfRequestExists } from '~/validators/roadDecision.validator';
import { checkIfDriverExists } from '~/validators/driver.validator';
import { deleteRouteProposition, getPassengersIdByRequestId, moveRoadFromTemporaryToFinal } from '~/repositories/tempRoad.repository';
import { removePassengersFromSeats } from '~/repositories/driver.repository';
import { ws } from 'src/server';
import { findPassengerById } from '~/repositories/passenger.repository';
import { Passenger } from '~/models/passenger.model';

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

    var passengersIds = await getPassengersIdByRequestId(requestId);
    const passengers: Passenger[] = await Promise.all(passengersIds.passengerId.map(async (passengerId) => {
        const { passenger, error } = await findPassengerById(passengerId);
        if (error) {
            throw new Error(error);
        }
        return passenger!;
    })).catch((error) => {
        res.status(500).json({ error: error.message });
        return [];
    });

    if(decision === 'accept') {
        await moveRoadFromTemporaryToFinal(requestId);
        passengersIds.passengerId.forEach((passengerId) => {
            ws.sendMessageToPassenger(passengerId, JSON.stringify({ type: "road_accepted", message: "Your road has been accepted" }));
        });
    } else if (decision === 'reject') {
        passengers.forEach((passenger) => {
            removePassengersFromSeats(driverId, passenger.numberOfPeople);
            ws.sendMessageToPassenger(passenger.userId, JSON.stringify({ type: "road_rejected", message: "Your road has been rejected" }));
        });
        await deleteRouteProposition(requestId);
    }

    return res.status(200).json({});
});
