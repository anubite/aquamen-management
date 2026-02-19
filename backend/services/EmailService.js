const nodemailer = require('nodemailer');

class EmailService {
    static async sendEmail({ to, cc, subject, html, fromName, fromEmail, replyTo, settings }) {
        // SMTP Configuration from settings or environment
        const port = parseInt(process.env.SMTP_PORT || settings.smtp_port || 587);
        const config = {
            host: process.env.SMTP_HOST || settings.smtp_host,
            port: port,
            secure: process.env.SMTP_SECURE !== undefined
                ? process.env.SMTP_SECURE === 'true'
                : (settings.smtp_secure === 'true' || port === 465)
        };

        const user = process.env.SMTP_USER || settings.smtp_user;
        const pass = process.env.SMTP_PASS || settings.smtp_pass;

        if (user && pass) {
            config.auth = { user, pass };
        }

        const transporter = nodemailer.createTransport(config);

        const mailOptions = {
            from: `"${fromName || 'Aquamen'}" <${fromEmail}>`,
            to,
            cc,
            replyTo,
            subject,
            html
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Message sent: %s', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending email via SMTP:', error);
            throw error;
        }
    }
}

module.exports = EmailService;
