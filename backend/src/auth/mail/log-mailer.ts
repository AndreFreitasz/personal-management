import { Injectable, Logger } from '@nestjs/common';

import { MailerPort, PasswordResetMail } from './mailer.port';

@Injectable()
export class LogMailer extends MailerPort {
  private readonly logger = new Logger(LogMailer.name);

  sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.logger.log(
      `[dev] Redefinicao de senha para ${mail.to} (expira em ${mail.expiresInMinutes} min): ${mail.resetUrl}`,
    );
    return Promise.resolve();
  }
}
