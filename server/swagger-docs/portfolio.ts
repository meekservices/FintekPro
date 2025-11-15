/**
 * @swagger
 * /api/portfolios:
 *   get:
 *     tags:
 *       - Portfolio
 *     summary: Get user portfolios
 *     description: Retrieve all portfolios for authenticated user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of portfolios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Portfolio'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *   post:
 *     tags:
 *       - Portfolio
 *     summary: Create portfolio
 *     description: Create a new investment portfolio
 *     security:
 *       - cookieAuth: []
 *       - csrfToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: My Investment Portfolio
 *               description:
 *                 type: string
 *                 example: Long-term growth portfolio
 *     responses:
 *       201:
 *         description: Portfolio created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Portfolio'
 */

/**
 * @swagger
 * /api/portfolios/{portfolioId}:
 *   get:
 *     tags:
 *       - Portfolio
 *     summary: Get portfolio by ID
 *     description: Retrieve detailed portfolio information
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     responses:
 *       200:
 *         description: Portfolio details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Portfolio'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /api/portfolios/{portfolioId}/holdings:
 *   get:
 *     tags:
 *       - Portfolio
 *     summary: Get portfolio holdings
 *     description: Retrieve all holdings in a portfolio with real-time prices
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     responses:
 *       200:
 *         description: Portfolio holdings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   symbol:
 *                     type: string
 *                   quantity:
 *                     type: number
 *                   avgPrice:
 *                     type: number
 *                   currentPrice:
 *                     type: number
 *                   gainLoss:
 *                     type: number
 *                   gainLossPercent:
 *                     type: number
 */

/**
 * @swagger
 * /api/portfolios/{portfolioId}/analytics:
 *   get:
 *     tags:
 *       - Portfolio
 *     summary: Get portfolio analytics
 *     description: Retrieve analytics including XIRR, CAGR, asset allocation, and risk profile
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     responses:
 *       200:
 *         description: Portfolio analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 xirr:
 *                   type: number
 *                   example: 15.5
 *                 cagr:
 *                   type: number
 *                   example: 12.3
 *                 assetAllocation:
 *                   type: object
 *                 riskProfile:
 *                   type: string
 *                   enum: [conservative, moderate, aggressive]
 */

export {};
