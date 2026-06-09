import { Response } from "express";
import { AppError, normalizeError, getUserMessage } from "./errors";
import { v4 as uuidv4 } from "uuid";

export interface ApiSuccessResponse<T = any> {
	success: true;
	data: T;
	message?: string;
}

export interface ApiErrorResponse {
	success: false;
	error: string;
	message?: string;
	code?: string;
	traceId?: string;
	details?: any;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export const apiResponse = {
	success<T>(
		res: Response,
		data: T,
		message?: string,
		statusCode: number = 200,
	) {
		const response: ApiSuccessResponse<T> = {
			success: true,
			data,
		};

		if (message) {
			response.message = message;
		}

		return res.status(statusCode).json(response);
	},

	error(
		res: Response,
		error: string | AppError,
		statusCode?: number,
		details?: any,
	) {
		const traceId = res.locals.traceId || uuidv4();

		if (error instanceof AppError) {
			const response: ApiErrorResponse = {
				success: false,
				error: error.message,
				message: error.userMessage,
				code: error.name,
				traceId,
				details: error.context || details,
			};

			return res.status(error.status).json(response);
		}

		const response: ApiErrorResponse = {
			success: false,
			error: error,
			message: getUserMessage(statusCode || 500),
			traceId,
		};

		if (details) {
			response.details = details;
		}

		return res.status(statusCode || 500).json(response);
	},

	fromError(res: Response, error: unknown) {
		const appError = normalizeError(error);
		return this.error(res, appError);
	},

	created<T>(res: Response, data: T, message?: string) {
		return this.success(res, data, message, 201);
	},

	badRequest(res: Response, error: string, details?: any) {
		return this.error(res, error, 400, details);
	},

	unauthorized(res: Response, error: string = "Authentication required") {
		return this.error(res, error, 401);
	},

	forbidden(res: Response, error: string = "Access denied") {
		return this.error(res, error, 403);
	},

	notFound(res: Response, error: string = "Resource not found") {
		return this.error(res, error, 404);
	},

	serverError(
		res: Response,
		error: string = "Internal server error",
		details?: any,
	) {
		return this.error(res, error, 500, details);
	},
};

export const formatValidationErrors = (zodError: any): string => {
	if (zodError?.issues && Array.isArray(zodError.issues)) {
		return zodError.issues
			.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`)
			.join(", ");
	}
	return "Validation failed";
};
