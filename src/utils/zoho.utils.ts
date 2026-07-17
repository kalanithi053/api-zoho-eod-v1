// zoho.utils.ts
import { HttpException, HttpStatus } from "@nestjs/common";
import { AxiosError } from "axios";

export function throwIfZohoError(res: any) {
  if (res?.error) {
    handleZohoError(res.error);
  }
}

export function handleZohoAxiosError(err: unknown): never {
  if (err instanceof AxiosError && err.response?.data?.error) {
    handleZohoError(err.response.data.error);
  }
  throw err; // re-throw if it's not a recognizable Zoho error
}

function handleZohoError(error: any): never {
  // Zoho returns two error shapes:
  // 1. OAuth / bulk API: error is a plain string, e.g. "invalid_client"
  // 2. Projects API:     error is an object  { title, details[] }
  if (typeof error === "string") {
    throw new HttpException(
      {
        success: false,
        message: error,
        errors: [],
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  const { title, details } = error ?? {};
  throw new HttpException(
    {
      success: false,
      message: title ?? "Zoho API error",
      errors:
        details?.map((d: any) => ({
          field: d.field_name,
          message: d.message,
          key: d.message_key,
        })) ?? [],
    },
    HttpStatus.BAD_REQUEST,
  );
}
