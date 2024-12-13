import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { validateDriver } from '~/validators/driver.validator';
import { checkIfUserExists } from '~/validators/user.validator';
import { addDriver } from '~/repositories/driver.repository';
import { addSegmentToDriverRoad, createDriverRoad } from '~/services/driver-road.service';
import { checkIfPointIsAvailable, checkIfUserIsInRoad, getRoadByUserId } from '~/repositories/road.repository';
import { findPassengerById } from '~/repositories/passenger.repository';

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

    const { passenger, error: findPassengerByIdError } = await findPassengerById(userId);
    if (findPassengerByIdError) {
        return res.status(500).json({ error: "Error fetching passengers" });
    }
    if (passenger) {
        return res.status(400).json({ error: "User is already a passenger" });
    }

    const { isAvailable, error: isAvailableError } = await checkIfPointIsAvailable(driverModel!.longitude, driverModel!.latitude);
    if(isAvailableError) {
        return res.status(500).json({ error: isAvailableError });
    }
    if(!isAvailable) {
        return res.status(400).json({ error: "Location is not avaliable" });
    }

    const { isUserInRoad } = await checkIfUserIsInRoad(userId);
    if(isUserInRoad) {
        return res.status(400).json({ error: "User already has a road" });
    }

    const { error: driverAddError } = await addDriver(driverModel!);
    if (driverAddError) {
        return res.status(500).json({ error: "Error adding driver" });
    }

    const { roadId, error: roadError } = await createDriverRoad(driverModel!.userId);
    if (roadError) {
        return res.status(500).json({ error: "Error creating road" });
    }

    const { error: segmentError } = await addSegmentToDriverRoad(roadId!);
    if (segmentError) {
        return res.status(500).json({ error: "Error adding segment" });
    }

    const { road, error: roadNotFoundError } = await getRoadByUserId(userId);
    if (roadNotFoundError) {
        return res.status(404).json({ error: "Road not found" });
    }

    return res.status(200).json({road});
});
