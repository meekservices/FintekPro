import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { storage } from "./storage";
import { validateSessionPortal } from "./subdomain-middleware";

// Extend express-session to include passport property
declare module "express-session" {
	interface SessionData {
		passport: {
			user: string;
		};
		portalType?: string;
	}
}

/**
 * Global authentication middleware to check if a user is logged in.
 * Exported for use in other route files.
 */
export function isAuthenticated(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (req.isAuthenticated()) {
		return next();
	}
	res
		.status(401)
		.json({ error: "Unauthorized", message: "Please log in to continue" });
}

export async function setupAuth(app: Express) {
	// 1. Session Store Configuration
	// We use the centralized storage.sessionStore instance to ensure pool consistency
	const sessionStore = storage.sessionStore;

	// 2. Cookie Configuration
	// DO NOT set a domain on the session cookie. A host-only cookie (no Domain attribute)
	// is scoped to exactly the current subdomain (e.g. agent.fintekpro.com) and is the
	// most reliable approach for single-subdomain portals.
	console.log(
		"[AUTH_SETUP] Session cookie: host-only (no Domain attribute) for maximum reliability",
	);

	// CRITICAL: Trust proxy must be set BEFORE session middleware.
	// express-session uses req.secure (which respects trust proxy) to decide whether
	// to set the Secure flag on the cookie at response time.
	app.set("trust proxy", true);

	const cookieOptions: session.CookieOptions = {
		maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		// SameSite=None: required because the app sits behind a CDN proxy
		// (Firebase Hosting → Cloud Run). SameSite=Lax can block cookies in this context.
		// SameSite=None REQUIRES Secure=true (enforced above in production).
		sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
		path: "/",
		// No domain attribute: cookie is host-only, scoped to exact subdomain.
	};

	const sessionSecret =
		process.env.SESSION_SECRET ||
		(!process.env.NODE_ENV || process.env.NODE_ENV !== "production"
			? process.env.REPL_ID || "fintek-secure-session-secret-2024"
			: undefined);

	if (!sessionSecret) {
		throw new Error("SESSION_SECRET must be configured in production.");
	}

	// 3. Register Session Middleware
	app.use(
		session({
			name: "fintekpro.sid",
			secret: sessionSecret,
			resave: false,
			saveUninitialized: false,
			rolling: true,
			store: sessionStore,
			cookie: cookieOptions,
			proxy: true,
		}),
	);

	// 4. Initialize Passport
	app.use(passport.initialize());
	app.use(passport.session());

	// 5. X-Session-ID Fallback Middleware
	// When cookie-based auth fails (due to CDN proxying, SameSite issues, etc.),
	// the client can send the raw session ID as an X-Session-ID header.
	// SECURITY: We validate the session exists in the PostgreSQL store AND has a
	// valid passport.user before restoring it. The session ID is the same one
	// signed and stored by express-session, so forgery is prevented (session must
	// already be in the DB).
	app.use(async (req: Request, res: Response, next: NextFunction) => {
		// Skip if already authenticated via cookie
		if (req.isAuthenticated()) {
			return next();
		}

		const headerSessionId = req.headers["x-session-id"] as string | undefined;
		if (!headerSessionId) {
			return next();
		}

		try {
			// Strip the "s:" prefix if present (express-session signed format)
			const rawSid = headerSessionId.startsWith("s:")
				? headerSessionId.slice(2).split(".")[0]
				: headerSessionId;

			// Get the session directly from the PostgreSQL store
			(sessionStore as any).get(rawSid, async (err: any, sessionData: any) => {
				if (err || !sessionData) {
					return next();
				}

				const passportUserId = sessionData?.passport?.user;
				if (!passportUserId) {
					return next();
				}

				// Restore the user object from the database
				const user = await storage.getUser(passportUserId);
				if (!user) {
					return next();
				}

				// Override sessionID to ensure updates are persisted back to rawSid
				req.sessionID = rawSid;

				// Manually attach the authenticated user to the request
				(req as any).user = user;
				(req as any).isAuthenticated = () => true;

				// Populate req.session with stored session data if it exists
				if (req.session) {
					Object.assign(req.session, sessionData);
				}

				console.log(
					`[X-SESSION-ID] Restored session for user ${user.id} via header (cookie bypass)`,
				);
				next();
			});
		} catch (e) {
			console.warn("[X-SESSION-ID] Fallback restore error:", e);
			next();
		}
	});

	// 6. Portal Context Validation
	// Ensure that the session portal context matches the current subdomain
	app.use(validateSessionPortal);

	// 7. Serialize/Deserialize User for persistent sessions
	passport.serializeUser((user: any, done) => {
		done(null, user.id);
	});

	passport.deserializeUser(async (id: string, done) => {
		try {
			const user = await storage.getUser(id);
			if (!user) {
				console.warn(
					`[PASSPORT] deserializeUser: user ${id} NOT FOUND in DB → session invalid`,
				);
				return done(null, false);
			}
			done(null, user);
		} catch (err) {
			console.error(`[PASSPORT] deserializeUser ERROR for id ${id}:`, err);
			done(err);
		}
	});

	console.log("✅ [AUTH_SETUP] Session and Passport middleware initialized!");

	// 8. Session Debug Endpoint — safe to expose, returns non-sensitive info
	app.get("/api/session-debug", (req: Request, res: Response) => {
		const hasSession = !!req.session;
		const sessionID = req.sessionID || null;
		const passportUser = (req.session as any)?.passport?.user || null;
		const portalType = (req.session as any)?.portalType || null;
		const isAuth = req.isAuthenticated();
		const userId = (req as any).user?.id || null;
		const cookieHeader = req.headers.cookie || "(no cookie sent)";
		const hasFintekCookie = cookieHeader.includes("fintekpro.sid");
		const hasSessionHeader = !!req.headers["x-session-id"];

		console.log(
			`[SESSION_DEBUG] sid=${sessionID} | passport.user=${passportUser} | isAuth=${isAuth} | portal=${portalType} | cookie=${hasFintekCookie} | header=${hasSessionHeader}`,
		);

		res.json({
			hasSession,
			sessionID,
			passportUser,
			portalType,
			isAuthenticated: isAuth,
			userId,
			hasFintekCookie,
			hasSessionHeader,
			cookieNames: cookieHeader
				.split(";")
				.map((c: string) => c.trim().split("=")[0])
				.filter(Boolean),
		});
	});
}
