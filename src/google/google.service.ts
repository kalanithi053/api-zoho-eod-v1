import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google, sheets_v4 } from "googleapis";
import * as nodemailer from "nodemailer";
import { UserDocument } from "../users/schemas/user.schema";

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(private readonly configService: ConfigService) {}

  private getConfig(key: string): string {
    return this.configService.getOrThrow<string>(key);
  }

  private getOAuth2Client(refreshToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      this.getConfig("GOOGLE_CLIENT_ID"),
      this.getConfig("GOOGLE_CLIENT_SECRET"),
      this.getConfig("GOOGLE_OAUTH_API"),
    );
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
    return oauth2Client;
  }

  private getSheetsClient(refreshToken: string): sheets_v4.Sheets {
    const auth = this.getOAuth2Client(refreshToken);
    return google.sheets({ version: "v4", auth });
  }

  async configTransporter(refreshToken: string, email: string) {
    const oauth2Client = this.getOAuth2Client(refreshToken);
    const accessTokenResult = await oauth2Client.getAccessToken();

    if (!accessTokenResult.token) {
      throw new Error("Unable to generate access token");
    }

    const clientId = this.getConfig("GOOGLE_CLIENT_ID");
    const clientSecret = this.getConfig("GOOGLE_CLIENT_SECRET");

    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: email,
        clientId,
        clientSecret,
        refreshToken,
        accessToken: accessTokenResult.token,
      },
    });
  }

  async sendMail(user: UserDocument, subject: string, html: string) {
    const { email, configuration, name } = user;
    const transporter = await this.configTransporter(
      configuration?.googleRefreshToken,
      email,
    );
    await transporter.verify();
    const result = await transporter.sendMail({
      from: { address: email, name },
      subject,
      html,
      to: configuration?.recipient?.eodMailTo,
      cc: configuration?.recipient?.eodMailCc,
      bcc: configuration?.recipient?.eodMailBcc,
    });

    this.logger.log(`Email sent. MessageId: ${result.messageId}`);
    return result;
  }

  async getSheetRows(user: UserDocument): Promise<any> {
    const { googleRefreshToken, sheet } = user.configuration;

    const sheets = this.getSheetsClient(googleRefreshToken);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheet?.id ?? "",
      range: sheet?.sheetTabName,
    });
    const [_header, ...rows] = (response.data.values as string[][]) ?? [];
    this.logger.log(`${user.email} - ${JSON.stringify(response)}`);
    this.logger.log(`${user.email} - ${JSON.stringify(rows)}`);
    const today = new Date().toISOString().split("T")[0];

    return rows
      .filter((row) => row.length >= 3 && row[0] && row[2] === today)
      .map((row) => ({
        task: row[0],
        duration: Number(String(row[1]).trim()),
      }));
  }
}
