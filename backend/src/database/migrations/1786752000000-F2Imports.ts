import { MigrationInterface, QueryRunner } from 'typeorm';

export class F2Imports1786752000000 implements MigrationInterface {
  name = 'F2Imports1786752000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION fin_normalize_text(value text) RETURNS text
        LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
        SELECT btrim(regexp_replace(
          lower(translate(value,
            'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑáàãâäéèêëíìîïóòõôöúùûüçñ',
            'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
          '[^a-z0-9]+', ' ', 'g'))
      $$
    `);

    await queryRunner.query(`
      CREATE FUNCTION fin_fingerprint(account uuid, occurred timestamptz, amount numeric, descr text)
        RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
        SELECT md5(account::text
                || '|' || floor(extract(epoch from occurred) / 86400)::bigint::text
                || '|' || trim(to_char(amount, 'FM9999999999990.00'))
                || '|' || fin_normalize_text(descr))
      $$
    `);

    await queryRunner.query(`
      CREATE TABLE "import_profiles" (
        "id"                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"             uuid         NOT NULL REFERENCES "users"("id")    ON DELETE CASCADE,
        "account_id"          uuid         NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "delimiter"           varchar(8)   NOT NULL,
        "encoding"            varchar(16)  NOT NULL,
        "decimal_separator"   char(1)      NOT NULL,
        "date_format"         varchar(16)  NOT NULL,
        "skip_rows"           smallint     NOT NULL DEFAULT 0,
        "date_column"         varchar(128) NOT NULL,
        "description_column"  varchar(128) NOT NULL,
        "amount_mode"         varchar(16)  NOT NULL,
        "amount_column"       varchar(128),
        "debit_column"        varchar(128),
        "credit_column"       varchar(128),
        "invert_sign"         boolean      NOT NULL DEFAULT false,
        "created_at"          timestamptz  NOT NULL DEFAULT now(),
        "updated_at"          timestamptz  NOT NULL DEFAULT now(),

        CONSTRAINT "ck_import_profiles_delimiter"
          CHECK ("delimiter" IN (';', ',', E'\\t', '|', 'auto')),

        CONSTRAINT "ck_import_profiles_encoding"
          CHECK ("encoding" IN ('utf-8', 'latin1', 'auto')),

        CONSTRAINT "ck_import_profiles_decimal_separator"
          CHECK ("decimal_separator" IN (',', '.')),

        CONSTRAINT "ck_import_profiles_date_format"
          CHECK ("date_format" IN ('dd/MM/yyyy', 'dd/MM/yy', 'yyyy-MM-dd')),

        CONSTRAINT "ck_import_profiles_skip_rows"
          CHECK ("skip_rows" >= 0 AND "skip_rows" <= 100),

        -- As duas formas de o arquivo dizer o sentido do dinheiro sao
        -- excludentes. Com as tres colunas preenchidas, ninguem saberia se
        -- "45,90" na coluna de valor e' entrada ou saida — e o CHECK e' o unico
        -- lugar onde essa duvida nao pode sobreviver a um UPDATE parcial.
        CONSTRAINT "ck_import_profiles_amount_shape" CHECK (
          ("amount_mode" = 'signed'
             AND "amount_column" IS NOT NULL
             AND "debit_column"  IS NULL
             AND "credit_column" IS NULL)
          OR
          ("amount_mode" = 'debit_credit'
             AND "amount_column" IS NULL
             AND "debit_column"  IS NOT NULL
             AND "credit_column" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_import_profiles_account" ON "import_profiles" ("account_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "imports" (
        "id"           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid         NOT NULL REFERENCES "users"("id")    ON DELETE CASCADE,
        "account_id"   uuid         NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "filename"     varchar(255) NOT NULL,
        "status"       varchar(16)  NOT NULL DEFAULT 'ready',
        "encoding"     varchar(16)  NOT NULL,
        "delimiter"    varchar(8)   NOT NULL,
        "row_count"    integer      NOT NULL,
        "period_start" date         NOT NULL,
        "period_end"   date         NOT NULL,
        "committed_at" timestamptz,
        "reverted_at"  timestamptz,
        "created_at"   timestamptz  NOT NULL DEFAULT now(),
        "updated_at"   timestamptz  NOT NULL DEFAULT now(),

        CONSTRAINT "ck_imports_status"
          CHECK ("status" IN ('ready', 'committed', 'reverted')),

        -- O periodo do arquivo, na ordem certa e dentro de um mes (E7.F3). O
        -- teto e' validado na API com mensagem util; o CHECK impede que um
        -- caminho futuro grave um lote de tres meses sem passar por la'.
        CONSTRAINT "ck_imports_period"
          CHECK ("period_end" >= "period_start"
             AND "period_end" <= "period_start" + INTERVAL '31 days'),

        CONSTRAINT "ck_imports_row_count"
          CHECK ("row_count" >= 0 AND "row_count" <= 1000),

        -- Cada carimbo so' existe no estado que o produz. Sem isso, um lote
        -- 'ready' com "committed_at" preenchido seria aceito, e o historico
        -- passaria a mostrar data de confirmacao para o que nunca foi
        -- confirmado.
        CONSTRAINT "ck_imports_stamps" CHECK (
          ("status" = 'ready'     AND "committed_at" IS NULL     AND "reverted_at" IS NULL)
          OR
          ("status" = 'committed' AND "committed_at" IS NOT NULL AND "reverted_at" IS NULL)
          OR
          ("status" = 'reverted'  AND "committed_at" IS NOT NULL AND "reverted_at" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_imports_user_created" ON "imports" ("user_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN "import_id" uuid REFERENCES "imports"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_transactions_import"
          ON "transactions" ("import_id") WHERE "import_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN "fingerprint" text
        GENERATED ALWAYS AS (
          fin_fingerprint("account_id", "occurred_at", "amount", "description")
        ) STORED
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_transactions_user_fingerprint"
          ON "transactions" ("user_id", "fingerprint")
    `);

    await queryRunner.query(`
      CREATE TABLE "import_items" (
        "id"                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        "import_id"              uuid          NOT NULL REFERENCES "imports"("id")      ON DELETE CASCADE,
        "user_id"                uuid          NOT NULL REFERENCES "users"("id")        ON DELETE CASCADE,
        "account_id"             uuid          NOT NULL REFERENCES "accounts"("id")     ON DELETE CASCADE,
        "line_number"            integer       NOT NULL,
        "occurred_at"            timestamptz,
        "description"            varchar(255),
        "amount"                 numeric(14,2),
        "type"                   varchar(16),
        "status"                 varchar(16)   NOT NULL,
        "selected"               boolean       NOT NULL DEFAULT true,
        "occurrence"             smallint      NOT NULL DEFAULT 1,
        "category_id"            uuid          REFERENCES "categories"("id")   ON DELETE SET NULL,
        "matched_transaction_id" uuid          REFERENCES "transactions"("id") ON DELETE SET NULL,
        "transaction_id"         uuid          REFERENCES "transactions"("id") ON DELETE SET NULL,
        "action"                 varchar(16),
        "error"                  text,
        "raw"                    text,
        "created_at"             timestamptz   NOT NULL DEFAULT now(),
        "updated_at"             timestamptz   NOT NULL DEFAULT now(),

        "fingerprint" text GENERATED ALWAYS AS (
          fin_fingerprint("account_id", "occurred_at", "amount", "description")
        ) STORED,

        CONSTRAINT "ck_import_items_status"
          CHECK ("status" IN ('new', 'duplicate', 'reconcile', 'error')),

        CONSTRAINT "ck_import_items_type"
          CHECK ("type" IS NULL OR "type" IN ('credit', 'debit')),

        CONSTRAINT "ck_import_items_action"
          CHECK ("action" IS NULL OR "action" IN ('created', 'reconciled')),

        -- Mesmo sinal de transactions: o valor e' positivo e o sentido vive em
        -- "type". Linha com erro nao tem valor nenhum, por isso o IS NULL.
        CONSTRAINT "ck_import_items_amount_positive"
          CHECK ("amount" IS NULL OR "amount" > 0),

        CONSTRAINT "ck_import_items_occurrence"
          CHECK ("occurrence" >= 1),

        -- Duas formas de linha, e nenhuma terceira: ou a linha virou dado
        -- completo, ou virou erro com motivo. Sem este CHECK caberia uma linha
        -- 'new' sem data, que quebraria o commit no INSERT em vez de na revisao.
        CONSTRAINT "ck_import_items_shape" CHECK (
          ("status" =  'error' AND "error" IS NOT NULL)
          OR
          ("status" <> 'error' AND "occurred_at" IS NOT NULL
                               AND "amount"      IS NOT NULL
                               AND "type"        IS NOT NULL
                               AND "description" IS NOT NULL)
        ),

        -- Linha com erro nao entra na carteira nem por engano de checkbox.
        CONSTRAINT "ck_import_items_error_not_selected"
          CHECK (NOT ("selected" AND "status" = 'error')),

        -- Conciliacao aponta para o lancamento previsto que ela confirma; sem
        -- alvo, "reconcile" nao quer dizer nada.
        CONSTRAINT "ck_import_items_reconcile_target"
          CHECK ("status" <> 'reconcile' OR "matched_transaction_id" IS NOT NULL)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_import_items_import_line" ON "import_items" ("import_id", "line_number")
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_import_items_fingerprint" ON "import_items" ("import_id", "fingerprint")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "import_items"`);

    await queryRunner.query(`DROP INDEX "ix_transactions_user_fingerprint"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "fingerprint"`);
    await queryRunner.query(`DROP INDEX "ix_transactions_import"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "import_id"`);

    await queryRunner.query(`DROP TABLE "imports"`);
    await queryRunner.query(`DROP TABLE "import_profiles"`);

    await queryRunner.query(`DROP FUNCTION "fin_fingerprint"(uuid, timestamptz, numeric, text)`);
    await queryRunner.query(`DROP FUNCTION "fin_normalize_text"(text)`);
  }
}
