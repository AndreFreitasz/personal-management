import { MigrationInterface, QueryRunner } from 'typeorm';

export class F0Foundation1786233600000 implements MigrationInterface {
  name = 'F0Foundation1786233600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"            varchar(255) NOT NULL,
        "password_hash"    varchar(255) NOT NULL,
        "name"             varchar(120) NOT NULL,
        "default_currency" char(3)      NOT NULL DEFAULT 'BRL',
        "timezone"         varchar(64)  NOT NULL DEFAULT 'America/Sao_Paulo',
        "created_at"       timestamptz  NOT NULL DEFAULT now(),
        "updated_at"       timestamptz  NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")`);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "family_id"      uuid        NOT NULL,
        "token_hash"     char(64)    NOT NULL,
        "expires_at"     timestamptz NOT NULL,
        "revoked_at"     timestamptz,
        -- Sem FK: e' trilha da rotacao, nao relacao navegavel. Uma FK aqui
        -- transformaria a limpeza de tokens velhos num problema de ordem.
        "replaced_by_id" uuid,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_refresh_tokens_hash" ON "refresh_tokens" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_tokens_family" ON "refresh_tokens" ("user_id", "family_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" char(64)    NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at"    timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_password_reset_tokens_hash" ON "password_reset_tokens" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_password_reset_tokens_user" ON "password_reset_tokens" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id"             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        uuid         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name"           varchar(80)  NOT NULL,
        "kind"           varchar(16)  NOT NULL,
        "color"          char(7),
        "icon"           varchar(40),
        "parent_id"      uuid         REFERENCES "categories"("id") ON DELETE RESTRICT,
        "is_default"     boolean      NOT NULL DEFAULT false,
        "monthly_budget" numeric(14,2),
        "archived_at"    timestamptz,
        "created_at"     timestamptz  NOT NULL DEFAULT now(),
        "updated_at"     timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "ck_categories_kind"
          CHECK ("kind" IN ('expense', 'income', 'transfer')),
        CONSTRAINT "ck_categories_budget_positive"
          CHECK ("monthly_budget" IS NULL OR "monthly_budget" > 0),
        CONSTRAINT "ck_categories_not_self_parent"
          CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_categories_user" ON "categories" ("user_id")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_categories_user_name" ON "categories" (
        "user_id",
        COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::uuid),
        lower("name")
      ) WHERE "archived_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id"                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"            uuid          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name"               varchar(80)   NOT NULL,
        "type"               varchar(16)   NOT NULL,
        "initial_balance"    numeric(14,2) NOT NULL DEFAULT 0,
        "initial_balance_at" date          NOT NULL,
        "currency"           char(3)       NOT NULL DEFAULT 'BRL',
        "archived_at"        timestamptz,
        "created_at"         timestamptz   NOT NULL DEFAULT now(),
        "updated_at"         timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "ck_accounts_type"
          CHECK ("type" IN ('checking', 'savings', 'credit_card', 'cash', 'investment'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_accounts_user" ON "accounts" ("user_id")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_accounts_user_name" ON "accounts" ("user_id", lower("name"))
        WHERE "archived_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id"                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"                uuid          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "account_id"             uuid          NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
        "destination_account_id" uuid          REFERENCES "accounts"("id") ON DELETE RESTRICT,
        "category_id"            uuid          REFERENCES "categories"("id") ON DELETE RESTRICT,
        "type"                   varchar(16)   NOT NULL,
        "amount"                 numeric(14,2) NOT NULL,
        "currency"               char(3)       NOT NULL DEFAULT 'BRL',
        "description"            varchar(255)  NOT NULL,
        "occurred_at"            timestamptz   NOT NULL,
        "competence"             date          NOT NULL,
        "classification_source"  varchar(16),
        "classified_at"          timestamptz,
        "created_at"             timestamptz   NOT NULL DEFAULT now(),
        "updated_at"             timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "ck_transactions_type"
          CHECK ("type" IN ('credit', 'debit', 'transfer')),
        -- O sinal vive em "type": a coluna nunca guarda negativo (§7).
        CONSTRAINT "ck_transactions_amount_positive"
          CHECK ("amount" > 0),
        -- Transferencia exige destino distinto; credito e debito nao tem destino.
        CONSTRAINT "ck_transactions_transfer_shape" CHECK (
          ("type" = 'transfer'
             AND "destination_account_id" IS NOT NULL
             AND "destination_account_id" <> "account_id")
          OR
          ("type" <> 'transfer' AND "destination_account_id" IS NULL)
        ),
        -- Competencia e' sempre o primeiro dia do mes.
        CONSTRAINT "ck_transactions_competence_first_day"
          CHECK (EXTRACT(DAY FROM "competence") = 1),
        CONSTRAINT "ck_transactions_classification_source"
          CHECK ("classification_source" IS NULL
                 OR "classification_source" IN ('rule', 'cache', 'llm', 'manual'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_transactions_user_occurred"
        ON "transactions" ("user_id", "occurred_at", "id")
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_transactions_user_category_competence"
        ON "transactions" ("user_id", "category_id", "competence")
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_transactions_unclassified"
        ON "transactions" ("user_id") WHERE "category_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "transaction_audits" (
        "id"             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        -- Sem FK para "transactions": a trilha precisa sobreviver a exclusao do
        -- lancamento que ela documenta.
        "transaction_id" uuid        NOT NULL,
        "user_id"        uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "action"         varchar(16) NOT NULL,
        "changes"        jsonb       NOT NULL,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_transaction_audits_action"
          CHECK ("action" IN ('created', 'updated', 'deleted'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_transaction_audits_transaction"
        ON "transaction_audits" ("transaction_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_transaction_audits_user"
        ON "transaction_audits" ("user_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transaction_audits"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
