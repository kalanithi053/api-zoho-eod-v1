import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { format } from "date-fns";
import { ApiService } from "../common/api.service";
import { zohoTaskStatus } from "../common/status";
import { CreateEodDto, TaskLogDto } from "../dto/get-time-log.dto";
import { TimeLogTaskDto } from "../dto/time-log-task.dto";
import { TrackCreateDTO, TrackModuleBodyDto } from "../dto/track.dto";
import { GoogleService } from "../google/google.service";
import { decodeHtmlEntities } from "../helper/stringManipulation.helper";
import { StatusMailPayload } from "../types/report.interface";
import { UserDocument } from "../users/schemas/user.schema";
import { UsersService } from "../users/users.service";
import { getLogBuiilder, sendResponse } from "../utils/getLog.builder";
import {
  buildLogPayloads,
  bulkUploadPayloadBuilder,
  throwErrorDurations,
} from "../utils/log.utils";
import { htmlGenerator } from "../utils/mail-template";
import { createOAuthAuthorizeUrl } from "../utils/oauth.util";
import { generateSubject } from "../utils/stringManipulation.helper";

export interface ZohoTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
  token_type?: string;
}

export interface ZohoPortal {
  id: string;
  portal_name: string;
  name?: string;
  is_default?: boolean;
}

export interface ZohoProjectMember {
  email: string;
  zpuid: string;
  name?: string;
}

export interface ZohoProject {
  id: string;
  name: string;
  team_members?: ZohoProjectMember[];
}

export interface ZohoTask {
  id: string;
  name: string;
  status?: {
    id: string;
    name: string;
  };
}

export interface TaskResponse {
  id: string;
  name: string;
  ownerId: string;
}

@Injectable()
export class ZohoService {
  private readonly logger = new Logger(ZohoService.name);

  private readonly authUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: string;
  private readonly projectApiBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    private readonly apiService: ApiService,
    private readonly googleService: GoogleService,
  ) {
    this.authUrl = this.configService.getOrThrow<string>("ZOHO_AUTH_URL");
    this.clientId = this.configService.getOrThrow<string>("ZOHO_CLIENT_ID");
    this.clientSecret =
      this.configService.getOrThrow<string>("ZOHO_CLIENT_SECRET");
    this.redirectUri =
      this.configService.getOrThrow<string>("ZOHO_REDIRECT_URI");
    this.scopes = this.configService.getOrThrow<string>("ZOHO_OAUTH_SCOPES");
    this.projectApiBaseUrl = this.configService.getOrThrow<string>(
      "ZOHO_PROJECT_API_BASE_URL",
    );
  }

  getAuthorizationUrl(userId: string): string {
    this.logger.debug(`Generating Zoho auth URL for user: ${userId}`);

    return createOAuthAuthorizeUrl({
      baseUrl: this.authUrl,
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      scope: this.scopes,
      state: userId,
    });
  }

  async generateToken(
    code: string,
    userId: string,
  ): Promise<ZohoTokenResponse> {
    const response = await this.exchangeToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
    });

    if (!response?.refresh_token || !response?.access_token) {
      throw new InternalServerErrorException("Failed to generate Zoho tokens");
    }

    this.logger.debug("Fetching Zoho portals");

    const portals = await this.fetchPortals(response.access_token);

    const defaultPortal = portals.find(
      (portal) => portal.portal_name === "amwhizcom",
    );

    await this.userService.updateZohoDetails(
      userId,
      response.refresh_token,
      defaultPortal,
    );

    return response;
  }

  async generateAccessToken(refreshToken: string): Promise<string> {
    const response = await this.exchangeToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    this.logger.debug("Zoho access token refreshed done");
    if (!response?.access_token) {
      throw new InternalServerErrorException("Failed to generate access token");
    }

    return response.access_token;
  }

  async requestZohoProject<T = unknown>(
    accessToken: string,
    options: {
      url: string;
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      params?: Record<string, unknown>;
      data?: unknown;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    return this.apiService.request<T>({
      ...options,
      url: `${this.projectApiBaseUrl}${options.url}`,
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        ...options.headers,
      },
    });
  }

  async fetchPortals(accessToken: string): Promise<ZohoPortal[]> {
    this.logger.debug("Fetching Zoho portals");

    return this.requestZohoProject<ZohoPortal[]>(accessToken, {
      url: "portals",
      method: "GET",
    });
  }

  async fetchProjects(
    portalId: string,
    refreshToken: string,
    user: UserDocument,
  ): Promise<ZohoProject[]> {
    this.logger.debug(`Fetching projects for portal: ${portalId}`);

    try {
      const accessToken = await this.generateAccessToken(refreshToken);

      const response = await this.requestZohoProject<ZohoProject[]>(
        accessToken,
        {
          url: `portal/${portalId}/projects`,
          method: "GET",
        },
      );

      const zohoUserId = response
        .flatMap((item) => item.team_members ?? [])
        .find(
          (member) => member.email?.toLowerCase() === user.email.toLowerCase(),
        )?.zpuid;

      if (zohoUserId) {
        await this.userService.updateZohoUser(user._id.toString(), zohoUserId);
      }

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to fetch projects for portal ${portalId}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );

      throw new InternalServerErrorException("Failed to fetch Zoho projects");
    }
  }

  private async exchangeToken(
    params: Record<string, unknown>,
  ): Promise<ZohoTokenResponse> {
    return this.apiService.request<ZohoTokenResponse>({
      url: `${this.authUrl}/oauth/v2/token`,
      method: "POST",
      params: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        ...params,
      },
    });
  }

  async getLog(user: UserDocument): Promise<StatusMailPayload> {
    const date = format(new Date(), "yyyy-MM-dd");
    const { portal, zohoUserId, zohoRefreshToken } = user?.configuration;
    const accessToken = await this.generateAccessToken(zohoRefreshToken);
    const response = await this.requestZohoProject<any>(accessToken, {
      url: `portal/${portal?.id}/timelogs`,
      method: "GET",
      params: getLogBuiilder(zohoUserId, date),
    });
    this.logger.log(
      `Total hours ${response.log_hours?.total_hours ?? 0} from ${date} for ${zohoUserId} - ${user.email}`,
    );
    return sendResponse(response) as StatusMailPayload;
  }

  async sendStatusMail(payload: StatusMailPayload, user: UserDocument) {
    this.logger.debug(`Send Mail ${JSON.stringify(payload)}`);

    if (!payload?.projects?.length) return;

    const htmlContent = htmlGenerator({
      ...payload,
      multipleProjects: payload.projects.length > 1,
      singleProject: payload.projects.length === 1,
    });

    const resourceName =
      payload.resourceName || payload.projects[0]?.logs?.[0]?.name || "";

    return await this.googleService.sendMail(
      user,
      generateSubject(resourceName, payload.reportDate),
      htmlContent,
    );
  }

  async triggerJob(user: UserDocument) {
    if (!user.configuration.zohoRefreshToken) {
      throw new InternalServerErrorException(
        "Your Zoho account is not connected",
      );
    }
    if (!user.configuration.zohoUserId) {
      throw new InternalServerErrorException(
        "Your Zoho Project's portal is not connected, update the portal details",
      );
    }
    if (!user.configuration.googleRefreshToken) {
      throw new InternalServerErrorException("Revalidate on Google OAuth");
    }
    if (!user.configuration.recipient?.eodMailTo?.length) {
      throw new InternalServerErrorException(
        "Atleast One Primary recipients of the daily summary is required",
      );
    }
    switch (user.configuration.cronOption) {
      case "CreateTask":
        return await this.sheetToReport(user);
      case "LogOnly":
        return await this.sheetToReport(user);
      case "EOD":
        const logs = await this.getLog(user);
        return await this.sendStatusMail(logs, user);
      default:
        throw new InternalServerErrorException("Invalid cron option");
    }
  }

  async sheetToReport(user: UserDocument) {
    const rows = await this.googleService.getSheetRows(user);
    return this.handleAutomateReportGenerator(
      rows as unknown as TimeLogTaskDto[],
      user,
    );
  }

  private findTaskByName(
    searchResult: ZohoTask[],
    taskName: string,
  ): ZohoTask | null {
    const tasks: ZohoTask[] = searchResult ?? [];
    return (
      tasks.find(
        (t) =>
          decodeHtmlEntities(t.name).toLowerCase()?.trim() ===
            decodeHtmlEntities(taskName).toLowerCase()?.trim() &&
          t?.status?.id !== zohoTaskStatus.lockedStatus,
      ) ?? null
    );
  }

  async postTask(
    {
      body,
      portalId,
      projectId,
    }: {
      body: TrackCreateDTO[];
      portalId: string;
      projectId: string;
    },
    user: UserDocument,
  ): Promise<TaskResponse[]> {
    const { zohoUserId, zohoRefreshToken } = user?.configuration;
    const accessToken = await this.generateAccessToken(zohoRefreshToken);
    const taskList = await this.requestZohoProject<{ tasks: ZohoTask[] }>(
      accessToken,
      {
        url: `portal/${portalId}/projects/${projectId}/tasks`,
        method: "GET",
      },
    );
    const result: any[] = [];
    for (const task of body) {
      const existingTask = this.findTaskByName(taskList?.tasks, task.name);

      const { duration, end_time, start_time, ...rest } = task;
      if (existingTask) {
        this.logger.log(`Task already exists: ${task.name}`);
        result.push({ ...existingTask, duration, end_time, start_time });
        continue;
      }

      const res = await this.requestZohoProject<Record<string, unknown>>(
        accessToken,
        {
          url: `portal/${portalId}/projects/${projectId}/tasks`,
          method: "POST",
          data: rest,
        },
      );
      result.push({ ...res, duration, end_time, start_time });
    }

    const response = result.reduce<TaskResponse[]>((acc, taskRes) => {
      const id = taskRes.id as string;
      const name = taskRes.name as string;
      acc.push({ id, name, ownerId: zohoUserId });
      return acc;
    }, []);

    this.logger.log(`Tasks processed: ${JSON.stringify(response)}`);
    return response;
  }

  async pushPostBulkLog(
    portalId: string,
    body: Record<string, any>[],
    user: UserDocument,
  ): Promise<any> {
    this.logger.log(`Posting bulk log: ${JSON.stringify(body)}`);
    const { zohoRefreshToken } = user?.configuration;
    const accessToken = await this.generateAccessToken(zohoRefreshToken);
    const formData = new FormData();
    formData.append("log_object", JSON.stringify(body));
    const result = await this.requestZohoProject<any>(accessToken, {
      url: `portal/${portalId}/addbulktimelogs`,
      method: "POST",
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    this.logger.log(`Bulk log added: ${JSON.stringify(result)}`);
    return result;
  }

  async postBulkLog(
    portalId: string,
    projectId: string,
    body: TrackModuleBodyDto[],
    user: UserDocument,
  ): Promise<any> {
    const payloads = buildLogPayloads(body).map((bulk) => ({
      project_id: projectId,
      item_id: bulk.module.id,
      type: bulk.module.type,
      date: bulk.date,
      bill_status: bulk.bill_status,
      notes: bulk.notes,
      owner_zpuid: bulk.owner_zpuid,
      start_time: bulk.start_time,
      end_time: bulk.end_time,
    }));
    return this.pushPostBulkLog(portalId, payloads, user);
  }

  async handleAutomateReportGenerator(
    body: TimeLogTaskDto[],
    user: UserDocument,
  ): Promise<StatusMailPayload> {
    const date = new Date().toISOString().split("T")[0];
    this.logger.debug(`logger date ${date} ${JSON.stringify(body)}`);

    return this.postLogWithTaskMail(
      {
        date,
        body,
      } as CreateEodDto,
      user,
    );
  }

  async postLogWithTaskMail(
    payload: CreateEodDto,
    user: UserDocument,
  ): Promise<StatusMailPayload> {
    const email = user.email;
    const { defaultProject: project } = user.configuration;
    const { body, date } = payload;
    const taskNames = body.map((d: TaskLogDto) => d.task);
    const duplicates = taskNames.filter(
      (name, i) => taskNames.indexOf(name) !== i,
    );

    if (duplicates.length) {
      throw new BadRequestException(
        `Duplicate task names found: ${[...new Set(duplicates)].join(", ")}`,
      );
    }
    throwErrorDurations(body);
    if (!body?.length) {
      throw new BadRequestException(`Task and report does not updated `);
    }
    const taskpayload: TrackCreateDTO[] = body.map((data: TaskLogDto) => ({
      name: data.task,
      owners_and_work: { owners: [{ email: email }] },
      duration: data.duration,
      start_time: data.startTime,
      end_time: data.endTime,
    }));
    const portalId = user.configuration.portal.id;
    const responseTask = await this.postTask(
      {
        portalId: portalId,
        projectId: project.id ?? "",
        body: taskpayload,
      },
      user,
    );
    const logOnTask = bulkUploadPayloadBuilder(responseTask, body, date);
    await this.postBulkLog(
      portalId,
      project.id ?? "",
      logOnTask as TrackModuleBodyDto[],
      user,
    );
    const logs = await this.getLog(user);
    await this.sendStatusMail(logs, user);
    return logs;
  }
}
