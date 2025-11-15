/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Basic health check
 *     description: Returns server health status (always 200 if running)
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 86400
 *                 environment:
 *                   type: string
 *                   example: production
 */

/**
 * @swagger
 * /ready:
 *   get:
 *     tags:
 *       - Health
 *     summary: Readiness check
 *     description: Checks if server is ready to accept traffic (includes DB connectivity)
 *     responses:
 *       200:
 *         description: Server is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 database:
 *                   type: string
 *                   example: connected
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Server is not ready
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /live:
 *   get:
 *     tags:
 *       - Health
 *     summary: Liveness check
 *     description: Kubernetes/container liveness probe
 *     responses:
 *       200:
 *         description: Server is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: alive
 */

/**
 * @swagger
 * /metrics:
 *   get:
 *     tags:
 *       - Health
 *     summary: Prometheus-compatible metrics
 *     description: Returns system metrics in JSON format (Prometheus-compatible)
 *     responses:
 *       200:
 *         description: System metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memory:
 *                   type: object
 *                   properties:
 *                     heapUsed:
 *                       type: number
 *                     heapTotal:
 *                       type: number
 *                     rss:
 *                       type: number
 *                     external:
 *                       type: number
 *                 cpu:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: number
 *                     system:
 *                       type: number
 *                 database:
 *                   type: object
 *                   properties:
 *                     latency:
 *                       type: number
 *                     status:
 *                       type: string
 *                 cache:
 *                   type: object
 *                   properties:
 *                     hitRate:
 *                       type: number
 *                     size:
 *                       type: number
 */

export {};
