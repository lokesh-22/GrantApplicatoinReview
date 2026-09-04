import { Resend } from 'resend';

// Resend instance initialized optionally if RESEND_API_KEY is present
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export interface NotificationPayload {
  type: 'REVIEWER_ASSIGNED' | 'APPLICATION_DECIDED';
  recipientEmail: string;
  recipientName: string;
  applicationOrg: string;
  fundingRound: string;
  extraInfo?: string;
}

/**
 * Clean Notification Dispatcher.
 * Automatically attempts Resend email delivery if RESEND_API_KEY is set.
 * Otherwise, gracefully logs structured notification details to stdout.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const { type, recipientEmail, recipientName, applicationOrg, fundingRound, extraInfo } = payload;

  let subject = '';
  let htmlContent = '';

  if (type === 'REVIEWER_ASSIGNED') {
    subject = `New Assignment: ${applicationOrg} (${fundingRound})`;
    htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Hello ${recipientName},</h2>
        <p>You have been assigned to review a grant application for <strong>${applicationOrg}</strong> under the <strong>${fundingRound}</strong> round.</p>
        ${extraInfo ? `<p><strong>Due Date:</strong> ${extraInfo}</p>` : ''}
        <p>Please log in to your Reviewer Portal to evaluate this proposal.</p>
      </div>
    `;
  } else if (type === 'APPLICATION_DECIDED') {
    subject = `Application Decision Recorded: ${applicationOrg}`;
    htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Hello ${recipientName},</h2>
        <p>A final decision has been recorded for application <strong>${applicationOrg}</strong> (${fundingRound}).</p>
        <p>Status updated to <strong>DECIDED</strong>.</p>
      </div>
    `;
  }

  // 1. Always write structured log notification
  console.log('\n======================================================');
  console.log(`✉️ NOTIFICATION HOOK TRIGGERED [${type}]`);
  console.log(` To: ${recipientName} <${recipientEmail}>`);
  console.log(` Subject: ${subject}`);
  if (extraInfo) console.log(` Details: ${extraInfo}`);
  console.log('======================================================\n');

  // 2. Dispatch real email via Resend if API key is provided
  if (resend) {
    try {
      await resend.emails.send({
        from: 'Grant Review Portal <onboarding@resend.dev>', // Resend free dev sandbox sender
        to: recipientEmail,
        subject,
        html: htmlContent,
      });
      console.log(`✅ [Resend] Email successfully sent to ${recipientEmail}`);
    } catch (err) {
      console.error(`❌ [Resend] Failed to send email to ${recipientEmail}:`, err);
    }
  } else {
    console.log('ℹ️ [Notification Note]: RESEND_API_KEY is not set. Notification recorded in logs. Add RESEND_API_KEY to .env to enable live email delivery via Resend sandbox.');
  }
}
