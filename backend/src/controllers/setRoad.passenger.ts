import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { checkIfUserExists } from '~/validators/user.validator';
import { checkIfPointIsAvailable } from '~/repositories/road.repository';
import { validatePassenger } from '~/validators/passenger.validator';
import { addPassenger } from '~/repositories/passenger.repository';
import { getTempRoadByUserId } from '~/repositories/tempRoad.repository';
import { createPassengerRoad } from '~/services/passegner-road.service';

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

    const { isAvailable, error: isAvailableError } = await checkIfPointIsAvailable(passengerModel!.longitude, passengerModel!.latitude);
    if(isAvailableError) {
        return res.status(500).json({ error: isAvailableError });
    }
    if(!isAvailable) {
        return res.status(400).json({ error: "Location is not available" });
    }

    const { error: driverAddError } = await addPassenger(passengerModel!);
    if (driverAddError) {
        return res.status(500).json({ error: "Error adding driver" });
    }

    const { error: roadError } = await createPassengerRoad(passengerModel!.userId);
    if (roadError) {
        return res.status(500).json({ error: "Error creating road" });
    }

    const { road, error: roadNotFoundError } = await getTempRoadByUserId(userId);
    if (roadNotFoundError) {
        return res.status(404).json({ error: "Road not found" });
    }

    return res.status(200).json({road});
});
