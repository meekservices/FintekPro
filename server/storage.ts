import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

// Lazy initialization of session store to prevent connection attempts during module import
let _sessionStore: any = null;

export const getSessionStore = () => {
  if (!_sessionStore) {
    _sessionStore = new PostgresSessionStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    });
  }
  return _sessionStore;
};

// ... rest of storage.ts (abbreviated for this call)
