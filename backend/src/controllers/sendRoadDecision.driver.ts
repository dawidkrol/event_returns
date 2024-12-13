import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { deleteRouteProposition, getNewPassengersIdByRequestId, moveRoadFromTemporaryToFinal } from '~/repositories/tempRoad.repository';
import { removePassengersFromSeats } from '~/repositories/driver.repository';
import { ws } from 'src/server';
import { findPassengerById } from '~/repositories/passenger.repository';
import { Passenger } from '~/models/passenger.model';
import { getPersonById } from '~/repositories/user.repository';
import { checkIfDriverExists } from '~/services/driver.service';
import { checkIfRequestAndDriverAreConnected, checkIfRequestExists } from '~/services/road-decision.service';
import { validateDecision } from '~/validators/decision.validator';
import { WithError } from '~/utils/utils.type';

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

    const { error: validateDecisionError } = validateDecision(decision);
    if (validateDecisionError) {
        return res.status(400).json({ error: validateDecisionError });
    }

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

    const passengersIds = await getNewPassengersIdByRequestId(requestId);
    const { passengers, error: fetchPassengersError } = await fetchPassengers(passengersIds.passengerId);
    if(fetchPassengersError) {
        return res.status(500).json({ error: fetchPassengersError });
    }

    const { user: drivingUser, error: driverInfoError } = await getPersonById(driverId);
    if (driverInfoError) {
        return res.status(500).json({ error: driverInfoError });
    }

    if (decision === 'accept') {
        await handleAcceptance(requestId, passengersIds.passengerId, drivingUser);
    } else if (decision === 'reject') {
        await handleRejection(requestId, passengers!, driverId);
    }

    return res.status(200).json({});
});


async function fetchPassengers(passengerIds: string[]): Promise<WithError<{passengers: Passenger[]}, string>> {
    try {
        return {
                passengers: await Promise.all(passengerIds.map(async (passengerId) => {
                    const { passenger, error } = await findPassengerById(passengerId);
                    if (error) {
                        throw new Error(error);
                    }
                    return passenger!;
            }))
        };
    } catch (error) {
        return {error: (error as Error).message};
    }
}

async function handleAcceptance(requestId: string, passengerIds: string[], drivingUser: any) {
    await moveRoadFromTemporaryToFinal(requestId);
    passengerIds.forEach((passengerId) => {
        ws.sendMessageToPassenger(
            passengerId,
            JSON.stringify({
                type: "road_accepted",
                message: "Your road has been accepted",
                driver: {
                    name: drivingUser?.name,
                    email: drivingUser?.email
                }
            })
        );
    });
}

async function handleRejection(requestId: string, passengers: Passenger[], driverId: string) {
    await deleteRouteProposition(requestId);
    for (const passenger of passengers) {
        await removePassengersFromSeats(driverId, passenger.numberOfPeople);
        ws.sendMessageToPassenger(
            passenger.userId,
            JSON.stringify({
                type: "road_rejected",
                message: "Your road has been rejected"
            })
        );
    }
}
