import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvestmentAsExpense1786579200000 implements MigrationInterface {
  name = 'InvestmentAsExpense1786579200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "categories"
         SET "name" = 'Investimento',
             "kind" = 'expense'
       WHERE "is_default" = true
         AND lower("name") = 'investidos'
    `);

    await queryRunner.query(`
      UPDATE "transactions" t
         SET "type" = 'debit',
             "destination_account_id" = NULL
        FROM "categories" c
       WHERE c."id" = t."category_id"
         AND c."is_default" = true
         AND lower(c."name") = 'investimento'
         AND t."type" = 'transfer'
    `);

    await queryRunner.query(`
      INSERT INTO "categories" ("user_id", "name", "kind", "color", "icon", "is_default")
      SELECT u."id", v."name", v."kind", v."color", v."icon", true
        FROM "users" u
        CROSS JOIN (VALUES
          ('Moradia', 'expense', '#2E7D5B', 'home'),
          ('Salário', 'income',  '#00875A', 'wallet')
        ) AS v("name", "kind", "color", "icon")
       WHERE NOT EXISTS (
         SELECT 1 FROM "categories" c
          WHERE c."user_id" = u."id"
            AND lower(c."name") = lower(v."name")
       )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "categories"
       WHERE "is_default" = true
         AND lower("name") IN ('moradia', 'salário')
         AND NOT EXISTS (
           SELECT 1 FROM "transactions" t WHERE t."category_id" = "categories"."id"
         )
    `);

    await queryRunner.query(`
      UPDATE "categories"
         SET "name" = 'Investidos',
             "kind" = 'transfer'
       WHERE "is_default" = true
         AND lower("name") = 'investimento'
    `);
  }
}
