const nodemailer = require('nodemailer');
const config = require('./index');

let transporter;

async function getTransporter() {
    // For local development, we use a local mail catcher like MailHog.
    // This avoids network/firewall issues with external SMTP servers.
    // MailHog runs an SMTP server on port 1025 by default.
    if (process.env.NODE_ENV !== 'production') {
        if (transporter) {
            return transporter;
        }
        transporter = nodemailer.createTransport({
            host: 'localhost', // or '127.0.0.1'
            port: 1025,
            secure: false, // MailHog does not use TLS
        });
        console.log('📬 Using local mail catcher for development.');
        return transporter;
    }

    // --- PRODUCTION CONFIGURATION ---
    // This is where you would put your real email service provider's details
    // (e.g., SendGrid, Mailgun, Gmail with an App Password)
    // This part of the code will not be used in your current development setup.
    throw new Error('Production mailer is not configured.');
}

exports.sendVerificationEmail = async (to, token) => {
    const mailer = await getTransporter();
    const verificationUrl = `http://localhost:3001/api/auth/verify/${token}`;

    const info = await mailer.sendMail({
        from: '"Sonalink" <noreply@sonalink.com>',
        to: to,
        subject: 'Verify Your Sonalink Account',
        html: `<b>Welcome to Sonalink!</b><p>Please click the link below to verify your email address:</p><a href="${verificationUrl}">${verificationUrl}</a>`,
    });

    console.log('Message sent: %s', info.messageId);
    // With MailHog, you view emails at http://localhost:8025
    if (nodemailer.getTestMessageUrl(info)) {
        console.log('Preview URL (Ethereal): %s', nodemailer.getTestMessageUrl(info));
    }
};

exports.sendPasswordResetEmail = async (to, token) => {
    const mailer = await getTransporter();
    // In a real frontend application, this would point to your password reset page
    const resetUrl = `http://localhost:3000/reset-password/${token}`;

    const info = await mailer.sendMail({
        from: '"Sonalink" <noreply@sonalink.com>',
        to: to,
        subject: 'Sonalink Password Reset Request',
        html: `<b>Password Reset</b><p>You requested a password reset. Please click the link below to set a new password. This link will expire in 1 hour.</p><a href="${resetUrl}">${resetUrl}</a>`,
    });

    console.log('Password reset message sent: %s', info.messageId);
    // With MailHog, you view emails at http://localhost:8025
    if (nodemailer.getTestMessageUrl(info)) {
        console.log('Preview URL (Ethereal): %s', nodemailer.getTestMessageUrl(info));
    }
};