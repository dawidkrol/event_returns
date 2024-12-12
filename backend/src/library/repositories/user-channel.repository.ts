import { UserChannel } from "~/models/user-channel.model";
import { query } from "~/utils/db";

export async function addUserChannel(userChannel: UserChannel): Promise<{ error: Error | null }> {
    try {
        await query(
            `INSERT INTO users_channels (user_id, channel_id) VALUES ($1, $2)`,
            [userChannel.userId, userChannel.channelId]
        );
        return { error: null };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { error: error as Error };
    }
    
}

export async function getChannelIdByUserId(userId: string): Promise<{ channelId: string | null }> {
    try {
        const result = await query(
            `SELECT channel_id FROM users_channels WHERE user_id = $1`,
            [userId]
        );
        return { channelId: result[0]?.channel_id };
    } catch (error: any) {
        console.error("Error executing query:", error);
        return { channelId: null };
    }
}

export async function deleteUserChannel(userId: string): Promise<void> {
    try {
        await query(
            `DELETE FROM users_channels WHERE user_id = $1`,
            [userId]
        );
    } catch (error: any) {
        console.error("Error executing query:", error);
    }
}