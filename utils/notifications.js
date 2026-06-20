const sendEmail = require('./mailer');

const FRONT_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function wrap(title, bodyHtml) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#222;">
        <div style="background:#1677ff; padding: 16px 24px; color:#fff;">
            <h2 style="margin:0;">${title}</h2>
        </div>
        <div style="padding: 24px; background:#f7f9fc;">
            ${bodyHtml}
            <hr style="border:none; border-top:1px solid #e1e6ef; margin:24px 0;" />
            <p style="font-size:12px; color:#888;">Screening Platform · automated message</p>
        </div>
    </div>`;
}

function btn(href, label) {
    return `<a href="${href}" style="display:inline-block;background:#1677ff;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;font-weight:600;">${label}</a>`;
}

async function safeSend(payload) {
    try {
        await sendEmail(payload);
    } catch (err) {
        console.log('Email failed:', err.message);
    }
}

// =====================================================================

async function notifyApplicationReceived(candidate, offer) {
    await safeSend({
        email: candidate.email,
        subject: `Application received — ${offer.title}`,
        content: `Hi ${candidate.firstName}, your application for "${offer.title}" has been received.`,
        html: wrap(
            'Application received',
            `<p>Hi <strong>${candidate.firstName}</strong>,</p>
             <p>Your application for <strong>${offer.title}</strong> has been received. We'll review it and get back to you soon.</p>
             <p>${btn(`${FRONT_URL}/my-applications`, 'View my applications')}</p>`
        ),
    });
}

async function notifyHrNewApplication(recruiter, candidate, offer) {
    if (!recruiter?.email) return;
    await safeSend({
        email: recruiter.email,
        subject: `New application — ${offer.title}`,
        content: `${candidate.firstName} ${candidate.lastName} applied to "${offer.title}".`,
        html: wrap(
            'New application',
            `<p><strong>${candidate.firstName} ${candidate.lastName}</strong> (${candidate.email}) just applied to <strong>${offer.title}</strong>.</p>
             <p>${btn(`${FRONT_URL}/offers/${offer._id}/applications`, 'View applications')}</p>`
        ),
    });
}

async function notifyApplicationStatusChange(candidate, offer, status) {
    if (!candidate?.email) return;
    const subjects = {
        INVITED: `You're invited to take the assessment — ${offer.title}`,
        REJECTED: `Update on your application — ${offer.title}`,
        HIRED: `Congratulations — ${offer.title}`,
        IN_PROGRESS: `Assessment in progress — ${offer.title}`,
        COMPLETED: `Assessment completed — ${offer.title}`,
    };
    const subject = subjects[status] || `Application update — ${offer.title}`;
    const link =
        status === 'INVITED' || status === 'IN_PROGRESS'
            ? `${FRONT_URL}/take/${offer._id}`
            : `${FRONT_URL}/my-applications`;
    const cta =
        status === 'INVITED' || status === 'IN_PROGRESS' ? 'Start assessment' : 'View status';
    await safeSend({
        email: candidate.email,
        subject,
        content: `Your application status for "${offer.title}" is now ${status}.`,
        html: wrap(
            subject,
            `<p>Hi <strong>${candidate.firstName}</strong>,</p>
             <p>Your application status for <strong>${offer.title}</strong> is now <strong>${status}</strong>.</p>
             <p>${btn(link, cta)}</p>`
        ),
    });
}

async function notifySessionStartingSoon(candidate, offer, session) {
    await safeSend({
        email: candidate.email,
        subject: `Reminder: assessment starts soon — ${offer.title}`,
        content: `Your assessment for "${offer.title}" starts at ${new Date(session.startAt).toLocaleString()}.`,
        html: wrap(
            'Assessment starting soon',
            `<p>Hi <strong>${candidate.firstName}</strong>,</p>
             <p>Your assessment window for <strong>${offer.title}</strong> opens at <strong>${new Date(session.startAt).toLocaleString()}</strong> and closes at <strong>${new Date(session.endAt).toLocaleString()}</strong>.</p>
             <p>${btn(`${FRONT_URL}/take/${offer._id}`, 'Open assessment')}</p>`
        ),
    });
}

async function notifyAttemptSubmitted(candidate, offer, attempt) {
    await safeSend({
        email: candidate.email,
        subject: `Submission received — ${offer.title}`,
        content: `Your assessment for "${offer.title}" was submitted.`,
        html: wrap(
            'Submission received',
            `<p>Hi <strong>${candidate.firstName}</strong>,</p>
             <p>We received your submission for <strong>${offer.title}</strong>.</p>
             ${attempt.status === 'GRADED'
                 ? `<p>Score: <strong>${attempt.totalScore} / ${attempt.maxScore}</strong></p>`
                 : `<p>Some answers require manual review. We'll notify you when results are ready.</p>`}
             <p>${btn(`${FRONT_URL}/my-applications`, 'View my applications')}</p>`
        ),
    });
}

async function notifyHrAttemptSubmitted(recruiter, candidate, offer, attempt) {
    if (!recruiter?.email) return;
    await safeSend({
        email: recruiter.email,
        subject: `Submission to review — ${offer.title}`,
        content: `${candidate.firstName} ${candidate.lastName} submitted their attempt.`,
        html: wrap(
            'New submission to review',
            `<p><strong>${candidate.firstName} ${candidate.lastName}</strong> just submitted their attempt for <strong>${offer.title}</strong>.</p>
             <p>Auto score: <strong>${attempt.autoScore} / ${attempt.maxScore}</strong>${
                 attempt.status === 'SUBMITTED' ? ' · pending manual grading' : ''
             }</p>
             <p>${btn(`${FRONT_URL}/attempts/${attempt._id}`, 'Review attempt')}</p>`
        ),
    });
}

async function notifyResultsReady(candidate, offer, attempt) {
    await safeSend({
        email: candidate.email,
        subject: `Results ready — ${offer.title}`,
        content: `Your final score for "${offer.title}" is ${attempt.totalScore}/${attempt.maxScore}.`,
        html: wrap(
            'Your results are ready',
            `<p>Hi <strong>${candidate.firstName}</strong>,</p>
             <p>Your final score for <strong>${offer.title}</strong> is <strong>${attempt.totalScore} / ${attempt.maxScore}</strong>.</p>
             <p>${btn(`${FRONT_URL}/my-applications`, 'View my applications')}</p>`
        ),
    });
}

async function sendCandidateReport(candidate, offer, attempt, questions, tests) {
    const { buildAttemptReport } = require('./pdf');
    const { PassThrough } = require('stream');

    const chunks = [];
    const passThrough = new PassThrough();
    passThrough.on('data', (chunk) => chunks.push(chunk));

    await new Promise((resolve, reject) => {
        passThrough.on('end', resolve);
        passThrough.on('error', reject);
        buildAttemptReport({ attempt, questions, tests, candidate, offer }, passThrough);
    });

    const pdfBuffer = Buffer.concat(chunks);

    await sendEmail({
        email: candidate.email,
        subject: `Your assessment report – ${offer.title}`,
        content: `Dear ${candidate.firstName},\n\nPlease find attached your assessment report for the position "${offer.title}".\n\nBest regards,\nThe Screening Team`,
        html: wrap(
            'Your Assessment Report',
            `<p>Dear <strong>${candidate.firstName}</strong>,</p>
            <p>Your assessment for the position <strong>${offer.title}</strong> has been graded.</p>
            <p>Please find your detailed report in the attached PDF.</p>`,
        ),
        attachments: [
            {
                filename: `report_${attempt._id}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            },
        ],
    });
}

module.exports = {
    notifyApplicationReceived,
    notifyHrNewApplication,
    notifyApplicationStatusChange,
    notifySessionStartingSoon,
    notifyAttemptSubmitted,
    notifyHrAttemptSubmitted,
    notifyResultsReady,
    sendCandidateReport,
};
