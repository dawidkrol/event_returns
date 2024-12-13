import { getDriverById, getNumberOfAvailablePassengers, getNumberOfAvailableSeats, changeNumberOfAvailableSeats, changeNumberOfAvailablePassengers } from "~/repositories/driver.repository";
import { WithError } from "~/utils/utils.type";

export async function checkIfDriverExists(driverID: string): Promise<WithError<{exists: boolean}, string>> {
    const { driver, error } = await getDriverById(driverID);
    if (error) {
        return { error: "Error fetching driver" };
    }
    if (!driver) {
        return { exists: false };
    }
    return { exists: true };
}

export async function changeNumberOfPossiblePassengers(driverID: string, newNumberOfSeats: number): Promise<{ error: string | null }> {
    const { numberOfPassengers, error: getNumberOfAvailablePassengersError } = await getNumberOfAvailablePassengers(driverID);
    if (getNumberOfAvailablePassengersError) {
        return { error: getNumberOfAvailablePassengersError };
    }
    if(numberOfPassengers === null || numberOfPassengers === undefined){
        return { error: "Number of passengers not found" };
    }

    const {numberOfSeats, error: getNumberOfAvailableSeatsError } = await getNumberOfAvailableSeats(driverID);
    if (getNumberOfAvailableSeatsError) {
        return { error: getNumberOfAvailableSeatsError };
    }
    if(numberOfSeats === null || numberOfSeats === undefined){
        return { error: "Number of seats not found" };
    }

    if (newNumberOfSeats < numberOfSeats && newNumberOfSeats < (numberOfSeats - numberOfPassengers)) {
        return { error: "Number of passengers exceeds number of available seats" };
    }

    const { error:changeNumberOfAvailableSeatsError } = await changeNumberOfAvailableSeats(driverID, newNumberOfSeats);
    if (changeNumberOfAvailableSeatsError != null) {
        return { error: changeNumberOfAvailableSeatsError };
    }

    const { error:changeNumberOfAvailablePassengersError } = await changeNumberOfAvailablePassengers(driverID, numberOfPassengers + (newNumberOfSeats - numberOfSeats));
    if (changeNumberOfAvailablePassengersError != null) {
        return { error: changeNumberOfAvailablePassengersError };
    }

    return { error: null };
}
