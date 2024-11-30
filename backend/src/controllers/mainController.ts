import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../library/utils/catchAsync';
import { callDatabaseFunction } from '../library/repositories/getRoad';

export const helloWorld = catchAsync(async (req: Request, res: Response, next?: NextFunction) => {
  var startLatitude = parseFloat(req.body.startLatitude as string);
  var startLongitude = parseFloat(req.body.startLongitude as string);
  var endLatitude = parseFloat(req.body.endLatitude as string);
  var endLongitude = parseFloat(req.body.endLongitude as string);

  if (isNaN(startLongitude) || isNaN(startLatitude) || isNaN(endLongitude) || isNaN(endLatitude)) {
    return res.status(400).json({ message: 'Invalid query parameters' });
  }

  console.log(startLongitude, startLatitude, endLongitude, endLatitude);
  
  res.status(200).json(await callDatabaseFunction(startLatitude, startLongitude, endLatitude, endLongitude));
});
