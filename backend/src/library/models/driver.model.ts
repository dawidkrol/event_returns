export interface Driver {
    userId: string;
    longitude: number;
    latitude: number;
    initialDepartureTime: Date;
    finalDepartureTime: Date;
    numberOfAvailableSeats: number;
}
