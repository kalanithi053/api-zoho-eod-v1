import { format, parseISO } from "date-fns";
import { GetTimeLogDto } from "../dto/get-time-log.dto";

export const getLogBuiilder = (query: GetTimeLogDto) => {
  const { userId, startDate } = query;
  return {
    page: 1,
    per_page: 500,
    view_type: "day",
    start_date: startDate,
    filter: JSON.stringify({
      criteria: [
        {
          field_name: "user",
          criteria_condition: "is",
          value: [userId],
        },
      ],
      pattern: "1",
    }),
    report_type: "module",
    module: JSON.stringify({
      type: "task",
    }),
  };
};

const addDurations = (time1: string, time2: string): string => {
  const [h1, m1] = time1.split(":").map(Number);
  const [h2, m2] = time2.split(":").map(Number);

  const totalMinutes = h1 * 60 + m1 + h2 * 60 + m2;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

type LogEntry = {
  date: string;
  task: string;
  duration: string;
  name: string;
};

export const sendResponse = (response: Record<string, any>) => {
  if (!response?.time_logs?.length) return { totalHours: 0, logs: [] };
  const logs: LogEntry[] =
    response.time_logs?.flatMap((day: any) =>
      day.log_details.map(
        (log: any): LogEntry => ({
          date: log.date,
          task: log.module_detail?.name,
          duration: log.log_hour,
          name: log.owner?.first_name,
        }),
      ),
    ) ?? [];
  const mergedLogs = Object.values(
    logs.reduce<Record<string, LogEntry>>((acc, log) => {
      if (!acc[log.task]) {
        acc[log.task] = { ...log };
      } else {
        acc[log.task].duration = addDurations(
          acc[log.task].duration,
          log.duration,
        );
      }

      return acc;
    }, {}),
  );

  return {
    totalHours: response.log_hours?.total_hours,
    projectName: response.time_logs?.[0]?.log_details?.[0]?.project?.name ?? "",
    reportDate: format(
      parseISO(response?.time_logs[0]?.log_details[0]?.date),
      "EEEE, MMMM d, yyyy",
    ),
    resourceName:
      response.time_logs?.[0]?.log_details?.[0]?.owner?.first_name ?? "",
    logs: mergedLogs,
  };
};
