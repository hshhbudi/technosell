import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required to run migrations");

const connection = await mysql.createConnection(url);
try {
  const db = drizzle(connection);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed");
} finally {
  await connection.end();
}
