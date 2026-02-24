// Email integration for MysticTxt (supports SendGrid and MailerSend via connector)

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  const data = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()) as any;

  const connectionSettings = data.items?.[0];
  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('Email service not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

function buildHtml(code: string, purpose: 'verify' | 'reset') {
  const heading = purpose === 'verify' ? 'Email Verification' : 'Password Reset';
  const message = purpose === 'verify'
    ? 'Use the code below to verify your email address and complete your registration.'
    : 'Use the code below to reset your password. If you did not request this, please ignore this email.';

  return `
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
}

async function sendViaSendGrid(apiKey: string, fromEmail: string, toEmail: string, subject: string, html: string) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: 'MysticTxt' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${text}`);
  }
}

async function sendViaMailerSend(apiKey: string, fromEmail: string, toEmail: string, subject: string, html: string) {
  const res = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: 'MysticTxt' },
      to: [{ email: toEmail }],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MailerSend error ${res.status}: ${text}`);
  }
}

function buildLiveChatAlertHtml(clientName: string, minutes: number, appUrl: string) {
  return `
    <div style="font-family: 'Georgia', serif; max-width: 500px; margin: 0 auto; background: #0A0A1A; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1A1035 0%, #0A0A1A 100%); padding: 32px; text-align: center;">
        <h1 style="color: #D4A853; font-size: 28px; margin: 0 0 4px 0;">MysticTxt</h1>
        <p style="color: #9B8EC4; font-size: 14px; margin: 0;">Incoming Live Chat</p>
      </div>
      <div style="padding: 32px; text-align: center;">
        <div style="background: rgba(76, 175, 80, 0.1); border: 2px solid #4CAF50; border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
          <p style="color: #4CAF50; font-size: 20px; font-weight: bold; margin: 0 0 8px 0;">📞 Incoming Call</p>
          <p style="color: #C8C0D8; font-size: 16px; margin: 0 0 4px 0;">${clientName}</p>
          <p style="color: #9B8EC4; font-size: 14px; margin: 0;">${minutes}-minute session</p>
        </div>
        <p style="color: #C8C0D8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">A client is waiting for you to accept their live chat session. Open the app now to connect!</p>
        <a href="${appUrl}" style="display: inline-block; background: #D4A853; color: #0A0A1A; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">Open MysticTxt</a>
      </div>
      <div style="padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
        <p style="color: #5A5270; font-size: 12px; margin: 0;">This is an automated alert from MysticTxt</p>
      </div>
    </div>
  `;
}

export async function sendLiveChatAlert(adminEmail: string, clientName: string, minutes: number) {
  try {
    const { apiKey, fromEmail } = await getCredentials();
    const appUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'https://mystic-text-portals.replit.app';

    const subject = `🔔 MysticTxt - Incoming Live Chat from ${clientName}`;
    const html = buildLiveChatAlertHtml(clientName, minutes, appUrl);

    if (apiKey.startsWith('mlsn.')) {
      await sendViaMailerSend(apiKey, fromEmail, adminEmail, subject, html);
    } else {
      await sendViaSendGrid(apiKey, fromEmail, adminEmail, subject, html);
    }
    console.log(`[Email] Live chat alert sent to ${adminEmail}`);
  } catch (err) {
    console.error('[Email] Failed to send live chat alert:', err);
  }
}

export async function sendOtpEmail(toEmail: string, code: string, purpose: 'verify' | 'reset') {
  const { apiKey, fromEmail } = await getCredentials();

  const subject = purpose === 'verify'
    ? 'MysticTxt - Verify Your Email'
    : 'MysticTxt - Reset Your Password';

  const html = buildHtml(code, purpose);

  if (apiKey.startsWith('mlsn.')) {
    await sendViaMailerSend(apiKey, fromEmail, toEmail, subject, html);
  } else {
    await sendViaSendGrid(apiKey, fromEmail, toEmail, subject, html);
  }
}
