export interface PasswordResetMail {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export abstract class MailerPort {
  abstract sendPasswordReset(mail: PasswordResetMail): Promise<void>;
}
