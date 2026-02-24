// SendGrid email integration for MysticTxt
import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email };
}

async function getUncachableSendGridClient() {
  const { apiKey, email } = await getCredentials();
  sgMail.setApiKey(apiKey);
  return { client: sgMail, fromEmail: email };
}

export async function sendOtpEmail(toEmail: string, code: string, purpose: 'verify' | 'reset') {
  const { client, fromEmail } = await getUncachableSendGridClient();

  const subject = purpose === 'verify'
    ? 'MysticTxt - Verify Your Email'
    : 'MysticTxt - Reset Your Password';

  const heading = purpose === 'verify'
    ? 'Email Verification'
    : 'Password Reset';

  const message = purpose === 'verify'
    ? 'Use the code below to verify your email address and complete your registration.'
    : 'Use the code below to reset your password. If you did not request this, please ignore this email.';

  const html = `
    <div style="font-family: 'Georgia', serif; max-width: 500px; margin: 0 auto; background: #0A0A1A; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1A1035 0%, #0A0A1A 100%); padding: 32px; text-align: center;">
        <h1 style="color: #D4A853; font-size: 28px; margin: 0 0 4px 0;">MysticTxt</h1>
        <p style="color: #9B8EC4; font-size: 14px; margin: 0;">${heading}</p>
      </div>
      <div style="padding: 32px; text-align: center;">
        <p style="color: #C8C0D8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">${message}</p>
        <div style="background: rgba(212, 168, 83, 0.1); border: 2px solid #D4A853; border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
          <span style="color: #D4A853; font-size: 36px; font-weight: bold; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #7A7290; font-size: 13px; margin: 0;">This code expires in 10 minutes.</p>
      </div>
      <div style="padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
        <p style="color: #5A5270; font-size: 12px; margin: 0;">Need help? Contact admin@mystictxt.com</p>
      </div>
    </div>
  `;

  await client.send({
    to: toEmail,
    from: { email: fromEmail, name: 'MysticTxt' },
    subject,
    html,
  });
}
