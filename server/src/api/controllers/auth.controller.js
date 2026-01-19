const bcrypt = require('bcrypt');
const pool = require('../models/db'); // Adjust path if needed
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config'); // Adjust path if needed
const AppError = require('./appError.js'); // Use './' for same directory
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../config/mailer'); // Adjust path if needed

const BCRYPT_SALT_ROUNDS = 12;

// --- ADDED 'next' PARAMETER ---
exports.signup = async (req, res, next) => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
        return next(new AppError('Name, email, and password are required.', 400));
    }

    // Validate email domain
    if (!email.endsWith('@sona.ac.in')) {
        return next(new AppError('Invalid email domain. Must be @sona.ac.in', 400));
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const newUserResult = await client.query(
            'INSERT INTO users (name, email, password_hash, email_verification_token) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
            [name, email, passwordHash, verificationToken]
        );
        const newUser = newUserResult.rows[0];

        // Send the verification email
        await sendVerificationEmail(newUser.email, verificationToken);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'User created successfully! Please check your email to verify your account.',
            user: newUser
        });

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { // PostgreSQL unique_violation
            return next(new AppError('Email already in use.', 409));
        }
        // Log the actual error for debugging
        console.error('Signup Error:', error);
        // Pass a generic error to the handler
        next(new AppError('An error occurred during the signup process.', 500));
    } finally {
        client.release();
    }
};

// --- ADDED 'next' PARAMETER ---
exports.forgotPassword = async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return next(new AppError('Email is required.', 400));
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        // Always send a generic success message
        if (userResult.rows.length === 0) {
            await client.query('COMMIT');
            client.release();
            return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        const user = userResult.rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await client.query(
            'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
            [resetToken, expires, user.id]
        );

        // Send the password reset email
        await sendPasswordResetEmail(user.email, resetToken);

        await client.query('COMMIT');

        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Forgot Password Error:', error); // Log actual error
        // Pass error to handler - but maybe keep generic msg for user?
        // For consistency with resendVerification, let's keep generic msg here too
        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        // OR pass to global handler: next(new AppError('Internal server error during password reset.', 500));
    } finally {
         // Ensure client is released even if error happens before catch block finishes
         if (client) client.release();
    }
};

// --- ADDED 'next' PARAMETER ---
exports.resetPassword = async (req, res, next) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    // Use next for validation errors too
    if (!password || !confirmPassword) {
         return next(new AppError('Password and confirmation are required.', 400));
    }
    if (password !== confirmPassword) {
        return next(new AppError('Passwords do not match.', 400));
    }
    // Add password strength validation here if needed

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userResult = await client.query(
            'SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            // Use next for operational errors
            return next(new AppError('Password reset token is invalid or has expired.', 400));
        }

        const user = userResult.rows[0];
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        await client.query(
            'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
            [passwordHash, user.id]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Password has been reset successfully.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Reset Password Error:', error); // Log actual error
        next(new AppError('Internal server error resetting password.', 500));
    } finally {
        client.release();
    }
};

// --- ADDED 'next' PARAMETER ---
exports.verifyEmail = async (req, res, next) => {
    const { token } = req.params;

    if (!token) {
        return next(new AppError('Verification token is missing.', 400));
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userResult = await client.query(
            'SELECT id FROM users WHERE email_verification_token = $1', // No need to select is_verified
            [token]
        );

        if (userResult.rows.length === 0) {
            // Use next for operational errors
            return next(new AppError('Invalid or expired verification token.', 400)); // Use 400 for bad token
        }

        const user = userResult.rows[0];

        // Update user - ensure idempotency (won't error if already verified with this token before)
        const updateResult = await client.query(
            'UPDATE users SET is_verified = TRUE, email_verification_token = NULL WHERE id = $1 AND is_verified = FALSE', // Only update if not already verified
            [user.id]
        );

        await client.query('COMMIT');

        // Check if the update actually changed a row
        if (updateResult.rowCount > 0) {
             console.log(`User ${user.id} verified successfully.`);
        } else {
             console.log(`User ${user.id} was already verified or token was already used.`);
        }

        // Send success HTML regardless of whether it was the first time
        res.status(200).send('<h1>Email verified successfully!</h1><p>You can now close this tab and log in to your Sonalink account.</p>');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Verify Email Error:', error); // Log actual error
        next(new AppError('Internal server error verifying email.', 500));
    } finally {
        client.release();
    }
};

// --- ADDED 'next' PARAMETER ---
exports.login = async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError('Email and password are required.', 400));
    }

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            // Use 401 for bad credentials
            return next(new AppError('Invalid credentials.', 401));
        }
        const user = userResult.rows[0];

        if (!user.is_verified) {
            // Use 403 Forbidden for account state issues
            return next(new AppError('Account not verified. Please check your email.', 403));
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return next(new AppError('Invalid credentials.', 401));
        }

        const payload = { userId: user.id }; // Consider adding role here if needed later
        const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '1d' }); // Use config

        res.status(200).json({
            token,
            // Return only necessary, safe user info
            user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url, role: user.role },
        });

    } catch (error) {
        console.error('Login Error:', error); // Log actual error
        next(new AppError('Internal server error during login.', 500));
    }
    // No client needed here if just using pool.query
};

// --- ADDED 'next' PARAMETER ---
exports.resendVerification = async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return next(new AppError('Email is required.', 400));
    }

    try {
        const userResult = await pool.query(
            'SELECT id, email, is_verified, email_verification_token FROM users WHERE email = $1',
            [email]
        );

        // Always send a generic success message
        const genericMessage = 'If an account with that email exists and is not verified, a new verification link has been sent.';

        if (userResult.rows.length === 0) {
            return res.status(200).json({ message: genericMessage });
        }

        const user = userResult.rows[0];

        if (!user.is_verified && user.email_verification_token) {
            try {
                await sendVerificationEmail(user.email, user.email_verification_token);
            } catch (mailError){
                 console.error('Resend Verification - Mail Send Error:', mailError);
                 // Proceed to send generic success below, don't stop the request
            }
        }

        res.status(200).json({ message: genericMessage });

    } catch (error) {
        console.error('Resend Verification - DB Error:', error);
        // Even on DB error, send generic success for security
        res.status(200).json({ message: 'If an account with that email exists and is not verified, a new verification link has been sent.' });
    }
    // No client needed here if just using pool.query
};
