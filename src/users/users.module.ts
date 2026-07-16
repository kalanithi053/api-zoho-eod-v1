import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ApiService } from "../common/api.service";
import { GoogleService } from "../google/google.service";
import { ZohoService } from "../zoho/zoho.service";
import { User, UserSchema } from "./schemas/user.schema";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { HttpExceptionFilter } from "../common/httpExceptionFilter";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UsersService, ZohoService, ApiService, GoogleService, HttpExceptionFilter],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
