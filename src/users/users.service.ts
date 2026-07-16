import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { GoogleProfile } from "../auth/interfaces/google-profile.interface";
import { HttpExceptionFilter } from "../common/httpExceptionFilter";
import { ZohoService } from "../zoho/zoho.service";
import { Portal, User, UserDocument } from "./schemas/user.schema";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(forwardRef(() => ZohoService))
    private readonly zohoService: ZohoService,
    private readonly httpExceptionFilter: HttpExceptionFilter,
  ) {}
  findAll() {
    return this.userModel.find().exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async findOrCreateFromGoogle(
    profile: GoogleProfile & { refreshToken?: string },
  ): Promise<UserDocument> {
    const refreshToken = profile.refreshToken ?? "";

    let user = await this.findByEmail(profile.email);

    if (!user) {
      user = new this.userModel({
        name: profile.name || profile.email,
        email: profile.email,
        userProfileUrl: profile.picture ?? null,
        configuration: {
          validatedGoogle: !!refreshToken,
          googleRefreshToken: refreshToken || null,
        },
      });
      return user.save();
    }

    user.configuration.validatedGoogle = !!refreshToken;
    if (refreshToken) {
      user.configuration.googleRefreshToken = refreshToken;
    }
    return user.save();
  }

  async updateZohoRefreshToken(
    id: string,
    refreshToken: string,
  ): Promise<UserDocument> {
    let user = await this.findById(id);

    if (!user) throw new NotFoundException("user not found");

    user.configuration.validatedZoho = true;
    user.configuration.zohoRefreshToken = refreshToken;

    return user.save();
  }

  async updateZohoDetails(
    id: string,
    refreshToken: string,
    portalDetails: { id: string; portal_name: string },
  ) {
    let user = await this.findById(id);
    this.logger.debug(
      "Fetched default portal details",
      JSON.stringify(portalDetails),
    );

    if (!user) throw new NotFoundException("user not found");

    user.configuration.validatedZoho = true;
    user.configuration.zohoRefreshToken = refreshToken;
    user.configuration.portal = {
      id: portalDetails?.id,
      name: portalDetails?.portal_name,
    };

    return user.save();
  }

  async updateZohoUser(id: string, zohoUserId: string) {
    let user = await this.findById(id);
    this.logger.debug("Fetched default zohoUserId", JSON.stringify(zohoUserId));

    if (!user) throw new NotFoundException("user not found");

    user.configuration.zohoUserId = zohoUserId;

    return user.save();
  }

  async revokeZohoRefreshToken(id: string): Promise<UserDocument> {
    this.logger.debug("revokeZohoRefreshToken", id);
    let user = await this.findById(id);

    if (!user) throw new NotFoundException("user not found");

    user.configuration.validatedZoho = false;
    user.configuration.zohoRefreshToken = "";
    user.configuration.portal = null;
    user.configuration.projects = [];
    return user.save();
  }

  async updateUserDetails(id: string, userData: User) {
    this.logger.debug("updateUserDetails", id, JSON.stringify(userData));
    const user = await this.userModel
      .findByIdAndUpdate(id, { ...userData }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException("user not found");
    }
    return user;
  }

  async updateZohoProject(
    id: string,
    projects: Portal[],
    defaultProject: Portal,
  ) {
    this.logger.debug("updateZohoProject", id);
    this.logger.debug(`Selected Projects ${JSON.stringify(projects)}`);
    this.logger.debug(`Default Projects ${JSON.stringify(defaultProject)}`);
    let user = await this.findById(id);
    if (!user) throw new NotFoundException("user not found");
    user.configuration.projects = projects;
    user.configuration.defaultProject = defaultProject;
    return user.save();
  }

  async triggerJob() {
    const users = await this.findAll();
    const triggerCron = users.filter((user) => user.configuration.triggerCron);
    const results = [];
    this.logger.debug(
      `Cron enabled users ${triggerCron.map((u) => u.email).join(";")}`,
    );
    for (const user of triggerCron) {
      try {
        let result: any;
        result = await this.zohoService.triggerJob(user);
        results.push({ email: user.email, success: true, result });
      } catch (error) {
        // Teleport exception to HttpExceptionFilter to trigger failure email
        const exception = new HttpException(
          {
            message: error instanceof Error ? error.message : String(error),
            email: user.email,
            jobFailureTriggerRecipient:
              user.configuration.jobFailureTriggerRecipient,
            refreshToken: user.configuration.googleRefreshToken,
            errors: [error instanceof Error ? error.stack : String(error)],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );

        const mockHost = {
          switchToHttp: () => ({
            getRequest: () => ({
              url: `/api/v1/users/trigger/cron-job?email=${encodeURIComponent(user.email)}`,
              method: "GET",
            }),
            getResponse: () => ({
              status: () => ({
                json: () => {},
              }),
            }),
          }),
        } as unknown as ArgumentsHost;

        try {
          await this.httpExceptionFilter.catch(exception, mockHost);
        } catch (err) {
          this.logger.error(
            `Failed to execute HttpExceptionFilter manually for ${user.email}`,
            err,
          );
        }

        results.push({
          email: user.email,
          jobFailureTriggerRecipient:
            user.configuration.jobFailureTriggerRecipient,
          refreshToken: user.configuration.googleRefreshToken,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.logger.debug(`result ${JSON.stringify(results)}`);
    return results?.map((v: any) => {
      delete v.refreshToken;
      return v;
    });
  }
}
