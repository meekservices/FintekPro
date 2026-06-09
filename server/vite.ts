import { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";

export function log(message: string, source = "express") {
	const formattedTime = new Date().toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
	});

	console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Setup Vite dev server - only used in development mode.
 *
 * IMPORTANT: Do NOT import vite.config.ts here (even dynamically).
 * vite.config.ts has a static `import { defineConfig } from 'vite'` at the top.
 * If esbuild inlines vite.config.ts into the bundle (which it does even for
 * dynamic imports when --splitting is not enabled), that static import becomes
 * a top-level import in dist/index.js — causing a startup crash in production
 * where `vite` is not installed.
 *
 * Instead, we pass `configFile: undefined` so Vite auto-discovers vite.config.ts
 * from the filesystem at dev-server startup time (safe because this function
 * is only ever called in development mode).
 */
export async function setupVite(app: Express, server: Server) {
	const { createServer: createViteServer, createLogger } = await import("vite");
	const viteLogger = createLogger();

	const vite = await createViteServer({
		// Do NOT set configFile: false — let Vite find vite.config.ts automatically.
		// This avoids bundling vite.config (and its vite imports) into dist/index.js.
		server: {
			middlewareMode: true,
			hmr: { server },
			allowedHosts: true,
		},
		appType: "custom",
		customLogger: {
			...viteLogger,
			error: (msg, options) => {
				viteLogger.error(msg, options);
				process.exit(1);
			},
		},
	});

	app.use(vite.middlewares);
	app.use("*", async (req, res, next) => {
		const url = req.originalUrl;

		try {
			const clientTemplate = path.resolve(
				import.meta.dirname,
				"..",
				"client",
				"index.html",
			);

			// Always reload the index.html file from disk in case it changes
			let template = await fs.promises.readFile(clientTemplate, "utf-8");
			template = template.replace(
				`src="/src/main.tsx"`,
				`src="/src/main.tsx?v=${nanoid()}"`,
			);
			const page = await vite.transformIndexHtml(url, template);
			res.status(200).set({ "Content-Type": "text/html" }).end(page);
		} catch (e) {
			vite.ssrFixStacktrace(e as Error);
			next(e);
		}
	});
}
