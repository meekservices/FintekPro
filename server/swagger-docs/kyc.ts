/**
 * @swagger
 * /api/kyc/status:
 *   get:
 *     tags:
 *       - KYC
 *     summary: Get KYC status
 *     description: Retrieve current KYC verification status for authenticated user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: KYC status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KYCStatus'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /api/kyc/production/verify-pan:
 *   post:
 *     tags:
 *       - KYC
 *     summary: Verify PAN number
 *     description: Verify PAN using production KYC workflow (CKYC → KRA → Video → Manual)
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
 *               - pan
 *               - dob
 *             properties:
 *               pan:
 *                 type: string
 *                 example: AAAPL1234C
 *               dob:
 *                 type: string
 *                 format: date
 *                 example: 1990-01-01
 *     responses:
 *       200:
 *         description: PAN verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 verified:
 *                   type: boolean
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /api/kyc/production/verify-aadhaar:
 *   post:
 *     tags:
 *       - KYC
 *     summary: Initiate Aadhaar verification
 *     description: Start Aadhaar OTP-based verification via Sandbox.co.in or Setu API
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
 *               - aadhaar
 *             properties:
 *               aadhaar:
 *                 type: string
 *                 example: "999999990019"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 transactionId:
 *                   type: string
 *       400:
 *         description: Invalid Aadhaar number
 */

/**
 * @swagger
 * /api/kyc/sessions:
 *   get:
 *     tags:
 *       - KYC
 *     summary: Get KYC sessions
 *     description: Retrieve all KYC verification sessions for the user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of KYC sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   status:
 *                     type: string
 *                   tier:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 */

export {};
