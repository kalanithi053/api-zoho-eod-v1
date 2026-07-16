import { BadRequestException } from "@nestjs/common";
import { TaskLogDto } from "../dto/get-time-log.dto";
import { TrackModuleBodyDto } from "../dto/track.dto";
import { decodeHtmlEntities } from "../helper/stringManipulation.helper";
import {
  WORK_START,
  formatTime,
  isValidDuration,
  skipBreaks,
  splitIntoSegments,
} from "./time.utils";

const BASE_LOG_PAYLOAD = {
  frompage: "taskdetails",
  notes: "<div>Worked on API integration</div>",
  bill_status: "Billable",
  for_timer: false,
};

export const buildLogPayload = (
  rest: Record<string, any>,
  start_time: string,
  end_time: string,
) => ({ ...rest, ...BASE_LOG_PAYLOAD, start_time, end_time });

const formateTimes = (time: string): string => {
  const [hour, period] = time.split(" ");
  const [h, m] = hour.split(":");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
};

export const buildLogPayloads = (
  body: TrackModuleBodyDto[],
): Record<string, any>[] => {
  const payloads: Record<string, any>[] = [];
  let cursor = WORK_START;

  for (const { start_time = "", end_time = "", duration, ...rest } of body) {
    const isDurationOnly = !start_time && !end_time && !Number.isNaN(duration);

    if (isDurationOnly) {
      if (!duration) {
        console.warn(`Skipping task ${rest?.module?.id}: no duration provided`);
        continue;
      }

      const segments = splitIntoSegments(cursor, Math.round(duration * 60));

      if (!segments.length) {
        console.warn(
          `Skipping task ${rest?.module?.id}: no segments generated`,
        );
        continue;
      }

      for (const { start, end } of segments) {
        payloads.push(
          buildLogPayload(rest, formatTime(start), formatTime(end)),
        );
      }

      cursor = skipBreaks(segments[segments.length - 1].end);
    } else {
      payloads.push(
        buildLogPayload(rest, formateTimes(start_time), formateTimes(end_time)),
      );
    }
  }

  return payloads;
};

export const throwErrorDurations = (body: TaskLogDto[]) => {
  let message = "";
  body.forEach((item, index) => {
    const hasDuration = item.duration !== undefined && item.duration !== null;
    const hasStartTime = !!item.startTime;
    const hasEndTime = !!item.endTime;

    if (!hasDuration && !hasStartTime && !hasEndTime) {
      message += `body.${index}: Duration or startTime and endTime must be provided.`;
    }

    if (hasDuration && !isValidDuration(String(item.duration))) {
      message += `body.${index}: duration "${item.duration}" must be a valid number (0.1 to infinity).`;
    }

    if (hasDuration && (hasStartTime || hasEndTime)) {
      message += `body.${index}: Provide either duration or startTime and endTime, not both.`;
    }
    if (!hasDuration && (!hasStartTime || !hasEndTime)) {
      message += `body.${index}: ${!hasStartTime ? "StartTime is required" : "EndTime is required"}`;
    }
  });
  if (message) throw new BadRequestException(message);
};

export const bulkUploadPayloadBuilder = (
  responseTask: Record<string, any>[],
  body: TaskLogDto[],
  date: string,
) =>
  responseTask?.map((task: any) => {
    const hasLogTimes =
      task.end_time !== undefined ||
      task.start_time !== undefined ||
      task.duration !== undefined;

    const currentDuration = hasLogTimes
      ? {
          endTime: task.end_time,
          startTime: task.start_time,
          duration: task.duration,
        }
      : body.find(
          (item: any) =>
            decodeHtmlEntities(item.task).toLowerCase().trim() ===
            decodeHtmlEntities(task.name).toLowerCase().trim(),
        );
    const {
      endTime = "",
      startTime = "",
      duration = 0,
    } = currentDuration ?? {};
    const data: Record<string, any> = {
      owner_zpuid: task.ownerId,
      date,
      module: { id: task.id, type: "task" },
    };
    if (endTime) data.end_time = endTime;
    if (startTime) data.start_time = startTime;
    if (duration) data.duration = duration;
    return data;
  });
