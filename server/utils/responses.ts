import { Response } from 'express';

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export const apiResponse = {
  success<T>(res: Response, data: T, message?: string, statusCode: number = 200) {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
    };
    
    if (message) {
      response.message = message;
    }
    
    return res.status(statusCode).json(response);
  },

  error(res: Response, error: string, statusCode: number = 500, details?: any) {
    const response: ApiErrorResponse = {
      success: false,
      error,
    };
    
    if (details) {
      response.details = details;
    }
    
    return res.status(statusCode).json(response);
  },

  created<T>(res: Response, data: T, message?: string) {
    return this.success(res, data, message, 201);
  },

  badRequest(res: Response, error: string, details?: any) {
    return this.error(res, error, 400, details);
  },

  unauthorized(res: Response, error: string = 'Authentication required') {
    return this.error(res, error, 401);
  },

  forbidden(res: Response, error: string = 'Access denied') {
    return this.error(res, error, 403);
  },

  notFound(res: Response, error: string = 'Resource not found') {
    return this.error(res, error, 404);
  },

  serverError(res: Response, error: string = 'Internal server error', details?: any) {
    return this.error(res, error, 500, details);
  },
};

export const formatValidationErrors = (zodError: any): string => {
  if (zodError?.issues && Array.isArray(zodError.issues)) {
    return zodError.issues
      .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
  }
  return 'Validation failed';
};
