import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "~/.env" });

const pool = new Pool({
    user: process.env.POSTGRES_USER || "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    database: process.env.POSTGRES_DB || "routing",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    port: Number(process.env.POSTGRES_PORT || 5432),
});

 
export const query = async (text: string, params?: any[]) => {
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res.rows;
    } catch (err) {
        console.error("Error executing query:", err);
        throw err as Error;
    } finally {
        client.release();
    }
};
