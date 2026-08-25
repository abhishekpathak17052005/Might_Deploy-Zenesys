import { Response } from "express";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({
    success: true,
    data,
  } as ApiResponse<T>);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400
): Response {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  } as ApiResponse<null>);
}
