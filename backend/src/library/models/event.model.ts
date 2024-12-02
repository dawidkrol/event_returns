import { User } from "./user.model";

export interface Event {
    eventName: string;
    eventDescription: string;
    longitude: number;
    latitude: number;
    eventDate: Date;
    organizer: User;
}