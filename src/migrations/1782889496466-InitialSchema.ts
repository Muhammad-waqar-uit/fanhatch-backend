import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1782889496466 implements MigrationInterface {
    name = 'InitialSchema1782889496466'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying NOT NULL, "username" character varying NOT NULL, "passwordHash" character varying NOT NULL, "bio" character varying, "avatarUrl" character varying, "walletAddress" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0e0c413bc95c218c105c35030f" ON "users" ("walletAddress") WHERE "walletAddress" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "holdings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "clubId" uuid NOT NULL, "keyCount" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_8242e05fae6757f2b56a2e97a30" UNIQUE ("userId", "clubId"), CONSTRAINT "PK_df4e42f95014be15a4ccc8547c0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d6f2b7c9389ff23f917f7220b0" ON "holdings" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_88c06b45f44a52949e6ee8499a" ON "holdings" ("clubId") `);
        await queryRunner.query(`CREATE TYPE "public"."clubs_curvetype_enum" AS ENUM('casual', 'standard', 'exclusive')`);
        await queryRunner.query(`CREATE TABLE "clubs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "clubId" integer NOT NULL, "ftId" character varying NOT NULL, "name" character varying NOT NULL, "ticker" character varying NOT NULL, "description" character varying, "avatarUrl" character varying, "curveType" "public"."clubs_curvetype_enum" NOT NULL, "creatorId" uuid NOT NULL, "socials" jsonb, "supply" integer NOT NULL DEFAULT '1', "keyPrice" numeric(20,8) NOT NULL DEFAULT '0', "memberCount" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_bb09bd0c8d5238aeaa8f86ee0d4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_21357d9eabaf3ee23d19a8b639" ON "clubs" ("clubId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4d335baf990ae2ddd22ec3dc26" ON "clubs" ("ftId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ba8880594f109c0a44213e47b" ON "clubs" ("creatorId") `);
        await queryRunner.query(`CREATE TYPE "public"."room_members_role_enum" AS ENUM('member', 'moderator', 'president')`);
        await queryRunner.query(`CREATE TABLE "room_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "roomId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."room_members_role_enum" NOT NULL DEFAULT 'member', CONSTRAINT "UQ_151cb61c3e462093aa3b8e70f7b" UNIQUE ("roomId", "userId"), CONSTRAINT "PK_4493fab0433f741b7cf842e6038" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a27f901523ddfa2eaecb16a597" ON "room_members" ("roomId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ca3c84760fb37c2f14658a0a2e" ON "room_members" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."chat_rooms_type_enum" AS ENUM('club', 'dm', 'group')`);
        await queryRunner.query(`CREATE TABLE "chat_rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "type" "public"."chat_rooms_type_enum" NOT NULL, "name" character varying NOT NULL, "avatarUrl" character varying, "clubId" uuid, "createdById" uuid NOT NULL, CONSTRAINT "PK_c69082bd83bffeb71b0f455bd59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."chat_messages_type_enum" AS ENUM('text', 'image', 'gif')`);
        await queryRunner.query(`CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "roomId" uuid NOT NULL, "senderId" uuid NOT NULL, "type" "public"."chat_messages_type_enum" NOT NULL DEFAULT 'text', "body" text NOT NULL, CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_140d8a52fcfdde16f5e26dcd7e" ON "chat_messages" ("roomId", "created") `);
        await queryRunner.query(`CREATE TABLE "follows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created" TIMESTAMP NOT NULL DEFAULT now(), "updated" TIMESTAMP NOT NULL DEFAULT now(), "followerId" uuid NOT NULL, "followeeId" uuid NOT NULL, CONSTRAINT "UQ_63cae1eb7767feee4555f00c5f1" UNIQUE ("followerId", "followeeId"), CONSTRAINT "PK_8988f607744e16ff79da3b8a627" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fdb91868b03a2040db408a5333" ON "follows" ("followerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_666a44940ce8279976767c6b5e" ON "follows" ("followeeId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_666a44940ce8279976767c6b5e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fdb91868b03a2040db408a5333"`);
        await queryRunner.query(`DROP TABLE "follows"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_140d8a52fcfdde16f5e26dcd7e"`);
        await queryRunner.query(`DROP TABLE "chat_messages"`);
        await queryRunner.query(`DROP TYPE "public"."chat_messages_type_enum"`);
        await queryRunner.query(`DROP TABLE "chat_rooms"`);
        await queryRunner.query(`DROP TYPE "public"."chat_rooms_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ca3c84760fb37c2f14658a0a2e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a27f901523ddfa2eaecb16a597"`);
        await queryRunner.query(`DROP TABLE "room_members"`);
        await queryRunner.query(`DROP TYPE "public"."room_members_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3ba8880594f109c0a44213e47b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d335baf990ae2ddd22ec3dc26"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_21357d9eabaf3ee23d19a8b639"`);
        await queryRunner.query(`DROP TABLE "clubs"`);
        await queryRunner.query(`DROP TYPE "public"."clubs_curvetype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_88c06b45f44a52949e6ee8499a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6f2b7c9389ff23f917f7220b0"`);
        await queryRunner.query(`DROP TABLE "holdings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e0c413bc95c218c105c35030f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
