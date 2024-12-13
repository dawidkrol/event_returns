import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { checkIfPointIsAvailable, checkIfUserIsInRoad, getRoadByUserId } from '~/repositories/road.repository';
import { validatePassenger } from '~/validators/passenger.validator';
import { addPassenger, findPassengerById } from '~/repositories/passenger.repository';
import { checkIfUserIsInTemporaryRoad, getTempRoadByUserId } from '~/repositories/tempRoad.repository';
import { createPassengerRoad } from '~/services/passegner-road.service';
import { getDriverById } from '~/repositories/driver.repository';
import { checkIfUserExists } from '~/services/user.service';

export const setRoadPassenger = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
    const { userId } = req.params;
    if(!userId) { 
        return res.status(400).json({ error: 'userId is required' });
    }

    const { passengerModel, error: driverError } = validatePassenger(req);
    if (driverError) {
        return res.status(400).json({ error: driverError });
    }

    const { error } = await checkIfUserExists(userId);
    if (error) {
        return res.status(404).json({ error: "User not found" });
    }

    const { driver, error: findPassengerByIdError } = await getDriverById(userId);
    if (findPassengerByIdError) {
        return res.status(500).json({ error: "Error fetching driver" });
    }
    if (driver) {
        return res.status(400).json({ error: "User is already a driver" });
    }
    
    const { isAvailable, error: isAvailableError } = await checkIfPointIsAvailable(passengerModel!.longitude, passengerModel!.latitude);
    if(isAvailableError) {
        return res.status(500).json({ error: isAvailableError });
    }
    if(!isAvailable) {
        return res.status(400).json({ error: "Location is not available" });
    }

    const { isUserInTemporaryRoad } = await checkIfUserIsInTemporaryRoad(userId);
    if(isUserInTemporaryRoad) {
        return res.status(400).json({ error: "User already has a road, wait for the driver to accept" });
    }

    const { isUserInRoad } = await checkIfUserIsInRoad(userId);
    if(isUserInRoad) {
        return res.status(400).json({ error: "User already has a road" });
    }

    const { error: driverAddError } = await addPassenger(passengerModel!);
    if (driverAddError) {
        return res.status(500).json({ error: "Error adding driver" });
    }

    const { requestId, error: roadError } = await createPassengerRoad(passengerModel!.userId);
    if (roadError) {
        return res.status(500).json({ error: roadError });
    }

    return res.status(200).json({requestId});
});
