import sendgrid from "@sendgrid/mail";

interface EmailTemplateData {
  otp_code: string;
  otp_code_expiration_minutes: string;
  user: {
    trusted_metadata: {
      project_name: string;
      project_logo?: string;
    };
  };
}

/**
 * Interface for email service implementations
 */
export interface EmailService {
  /**
   * Send an OTP email to the recipient
   */
  sendOTPEmail(
    otp: string,
    recipient: string,
    projectName: string,
    expiryMinutes?: string,
    projectLogo?: string,
  ): Promise<void>;
}

/**
 * SendGrid implementation of email service
 */
export class SendgridEmailService implements EmailService {
  constructor(
    private readonly sendgridAPIKey: string,
    private readonly emailTemplateId: string,
    private readonly fromEmail: string = "hello@crossmint.io",
  ) {
    sendgrid.setApiKey(this.sendgridAPIKey);
  }

  /**
   * Send an OTP email to the recipient via SendGrid
   */
  public async sendOTPEmail(
    otp: string,
    recipient: string,
    projectName: string,
    expiryMinutes = "5 minutes",
    projectLogo?: string,
  ): Promise<void> {
    const templateData: EmailTemplateData = {
      otp_code: otp,
      otp_code_expiration_minutes: expiryMinutes,
      user: {
        trusted_metadata: {
          project_name: projectName,
          project_logo: projectLogo,
        },
      },
    };

    const sendGridData = {
      to: recipient,
      from: this.fromEmail,
      templateId: this.emailTemplateId,
      dynamicTemplateData: templateData,
    };

    console.log("[DEBUG] Attempting to send email to:", recipient);
    console.log(sendGridData);

    await sendgrid.send(sendGridData);
  }
}
