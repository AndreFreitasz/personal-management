import { MigrationInterface, QueryRunner } from 'typeorm';

export class F1Recurrences1786492800000 implements MigrationInterface {
  name = 'F1Recurrences1786492800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN "status" varchar(16) NOT NULL DEFAULT 'paid'
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "ck_transactions_status"
        CHECK ("status" IN ('pending', 'paid'))
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_transactions_user_pending"
          ON "transactions" ("user_id", "occurred_at")
       WHERE "status" = 'pending'
    `);

    await queryRunner.query(`
      CREATE TABLE "recurrences" (
        "id"                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"                uuid         NOT NULL REFERENCES "users"("id")    ON DELETE CASCADE,
        "account_id"             uuid         NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
        "destination_account_id" uuid                  REFERENCES "accounts"("id") ON DELETE RESTRICT,
        "category_id"            uuid                  REFERENCES "categories"("id") ON DELETE RESTRICT,
        "type"                   varchar(16)  NOT NULL,
        "description"            varchar(255) NOT NULL,
        "currency"               char(3)      NOT NULL DEFAULT 'BRL',
        "schedule_type"          varchar(24)  NOT NULL,
        "day_of_month"           smallint,
        "adjustment"             varchar(24)  NOT NULL,
        "starts_on"              date         NOT NULL,
        "ends_on"                date,
        "installments"           smallint,
        "paused_at"              timestamptz,
        "created_at"             timestamptz  NOT NULL DEFAULT now(),
        "updated_at"             timestamptz  NOT NULL DEFAULT now(),

        CONSTRAINT "ck_recurrences_type"
          CHECK ("type" IN ('credit', 'debit', 'transfer')),

        CONSTRAINT "ck_recurrences_schedule_type"
          CHECK ("schedule_type" IN ('day_of_month', 'fifth_business_day', 'last_business_day')),

        CONSTRAINT "ck_recurrences_adjustment"
          CHECK ("adjustment" IN ('none', 'previous_business_day', 'next_business_day')),

        -- Dia do mes existe se, e somente se, o agendamento e' por dia fixo.
        -- Sem o "somente se", um dia 31 esquecido num agendamento por dia util
        -- ficaria de isca para quem for ler a linha depois.
        --
        -- O IS NOT NULL explicito NAO e' redundante com o BETWEEN. CHECK so'
        -- rejeita quando o resultado e' FALSE; NULL passa. Com day_of_month
        -- nulo, "NULL BETWEEN 1 AND 31" da' NULL, o primeiro ramo vira
        -- "TRUE AND NULL" = NULL, e "NULL OR FALSE" = NULL — dia fixo sem dia
        -- entrava calado. Foi o teste contra o banco que pegou isso.
        CONSTRAINT "ck_recurrences_day_of_month"
          CHECK (
            ("schedule_type" =  'day_of_month' AND "day_of_month" IS NOT NULL
                                              AND "day_of_month" BETWEEN 1 AND 31)
            OR
            ("schedule_type" <> 'day_of_month' AND "day_of_month" IS NULL)
          ),

        -- Competencia e' sempre o primeiro dia do mes, como em transactions.
        CONSTRAINT "ck_recurrences_competence_shape"
          CHECK (
            EXTRACT(DAY FROM "starts_on") = 1
            AND ("ends_on" IS NULL OR EXTRACT(DAY FROM "ends_on") = 1)
          ),

        CONSTRAINT "ck_recurrences_window"
          CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on"),

        -- O fim da recorrencia precisa de UMA fonte. Com os dois preenchidos,
        -- um UPDATE em so' um deles deixaria "12x" e "ate' dezembro" em
        -- desacordo, e a divergencia so' apareceria na parcela 13.
        CONSTRAINT "ck_recurrences_end_single_source"
          CHECK (NOT ("installments" IS NOT NULL AND "ends_on" IS NOT NULL)),

        CONSTRAINT "ck_recurrences_installments"
          CHECK ("installments" IS NULL OR "installments" > 0),

        -- Mesma coerencia de transferencia exigida em transactions (§2):
        -- dinheiro nao evapora, muda de lugar.
        CONSTRAINT "ck_recurrences_transfer_shape"
          CHECK (
            ("type" =  'transfer' AND "destination_account_id" IS NOT NULL
                                  AND "destination_account_id" <> "account_id")
            OR
            ("type" <> 'transfer' AND "destination_account_id" IS NULL)
          )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_recurrences_user_active" ON "recurrences" ("user_id", "paused_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "recurrence_amounts" (
        "id"            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        "recurrence_id" uuid          NOT NULL REFERENCES "recurrences"("id") ON DELETE CASCADE,
        "amount"        numeric(14,2) NOT NULL,
        "valid_from"    date          NOT NULL,
        "created_at"    timestamptz   NOT NULL DEFAULT now(),
        "updated_at"    timestamptz   NOT NULL DEFAULT now(),

        -- Sempre positivo: o sinal vive em recurrences.type, como em
        -- transactions. Comparar -0 e' fonte recorrente de bug.
        CONSTRAINT "ck_recurrence_amounts_positive" CHECK ("amount" > 0),

        CONSTRAINT "ck_recurrence_amounts_competence_shape"
          CHECK (EXTRACT(DAY FROM "valid_from") = 1)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_recurrence_amounts_period"
          ON "recurrence_amounts" ("recurrence_id", "valid_from")
    `);

    await queryRunner.query(`
      CREATE TABLE "generated_transactions" (
        "id"             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "recurrence_id"  uuid        NOT NULL REFERENCES "recurrences"("id") ON DELETE CASCADE,
        -- ON DELETE SET NULL, e nao CASCADE, de proposito: se o usuario apagar
        -- o lancamento materializado, esta linha sobrevive como lapide. Com
        -- CASCADE a marca sumiria junto, o job veria a competencia em aberto e
        -- recriaria o lancamento — o salario apagado voltaria sozinho, todo dia.
        "transaction_id" uuid                 REFERENCES "transactions"("id") ON DELETE SET NULL,
        "competence"     date        NOT NULL,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "ck_generated_transactions_competence_shape"
          CHECK (EXTRACT(DAY FROM "competence") = 1)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_generated_transactions_slot"
          ON "generated_transactions" ("recurrence_id", "competence")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "generated_transactions"`);
    await queryRunner.query(`DROP TABLE "recurrence_amounts"`);
    await queryRunner.query(`DROP TABLE "recurrences"`);

    await queryRunner.query(`DROP INDEX "ix_transactions_user_pending"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "ck_transactions_status"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "status"`);
  }
}
