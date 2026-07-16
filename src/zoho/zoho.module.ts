import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ApiService } from "../common/api.service";
import { GoogleService } from "../google/google.service";
import { User, UserSchema } from "../users/schemas/user.schema";
import { UsersService } from "../users/users.service";
import { ZohoController } from "./zoho.controller";
import { ZohoService } from "./zoho.service";
import { HttpExceptionFilter } from "../common/httpExceptionFilter";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [ZohoService, UsersService, ApiService, GoogleService, HttpExceptionFilter],
  controllers: [ZohoController],
})
export class ZohoModule {}
