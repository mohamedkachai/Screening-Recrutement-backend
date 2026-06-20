const nodemailer = require('nodemailer');

async function sendEmail(options) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const mailOptions = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.content,
        html: options.html,
        ...(options.attachments ? { attachments: options.attachments } : {}),
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent: ', info.messageId || info);

    return info;
}

module.exports = sendEmail;