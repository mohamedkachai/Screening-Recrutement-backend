const userModel = require('../models/user.model');
const sendEmail = require('../utils/mailer');
const { signUpSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } = require("../schemas/auth.schema");
const { generateToken } = require('../utils/jwt');
const crypto = require("crypto");

async function signUp(req, res) {
    try {
        const validation = signUpSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.flatten()
            })
        };
        // firstName, lastName, email, password, confirmPassword, dob
        const { firstName, lastName, email, password, confirmPassword, dob } = req.body;

        const existingUser = await userModel.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                status: false,
                message: 'Email already registered'
            })
        }

        const user = await userModel({
            email: email,
            firstName: firstName,
            lastName: lastName,
            password: password,
            confirmPassword: confirmPassword,
            dob: dob
        })

        await user.save();

        // SEND WELCOME MAIL (TODO)
        const options = {
            email: email,
            subject: "Welcome Mail",
            content: `Welcome aboard ${firstName} ${lastName}. Sent from http://localhost:3000`
        }

        await sendEmail(options);

        res.status(201).json({
            status: true,
            message: `Welcome aboard ${firstName} ${lastName}`
        })

    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

async function login(req, res) {
    try {
        const validation = loginSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.flatten()
            })
        };

        const { email, password } = req.body;

        // Find user by email
        const user = await userModel.findOne({ email }).select("+password");

        // Case1: user not found -> return error
        if (!user) {
            return res.status(400).json({
                status: false,
                message: "Invalid credentials"
            })
        };
        // Case2: user found -> check password
        const passwordMatch = await user.comparePassword(password);
        // case2.1: password incorrect -> return error
        if (!passwordMatch) {
            return res.status(400).json({
                status: false,
                message: "Invalid credentials"
            })
        }
        // case2.2: password correct -> generation auth token
        const token = generateToken(user._id);
        res.status(200).json({
            message: "logged in successfully",
            token
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

async function getMe(req, res) {
    try {
        res.status(200).json({
            status: true,
            user: req.user
        })
    } catch (error) {
        res.status(500).json({
            message: error.message || "Internal server error"
        })
    }
}

async function changePassword(req, res) {
    try {
        const validation = changePasswordSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.flatten()
            });
        }

        const { currentPassword, newPassword, confirmNewPassword } = req.body;

        // fetchUser + password 
        const user = await userModel.findById(req.user._id).select("+password");
        // verify currentPassword
        const passwordMatch = await user.comparePassword(currentPassword);

        if (!passwordMatch) {
            return res.status(400).json({
                status: false,
                message: "Current password is incorrect"
            });
        }
        // set New password to pre-save trigger
        user.password = newPassword;
        user.confirmPassword = confirmNewPassword;

        await user.save();

        res.status(200).json({
            status: true,
            message: 'Password changed succesfully'
        })
    } catch (error) {
        res.status(500).json({
            message: error.message || "Internal server error"
        })
    }
}

async function forgotPassword(req, res) {
    try {
        // Validate Schema
        const validation = forgotPasswordSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.flatten()
            })
        }
        // User exists with provided email
        const { email } = req.body;

        const user = await userModel.findOne({ email }).select("+resetPasswordToken +resetPasswordExpire");

        if (!user) {
            return res.status(404).json({
                status: false,
                message: "No user found with this email"
            });
        }
        // Reset Password Token (Valid 10 minutes)
        const { resetToken, resetPasswordToken, resetPasswordExpire } = user.getResetPasswordToken();

        // Save it under User
        await userModel.findByIdAndUpdate(user._id, {resetPasswordToken, resetPasswordExpire});

        // Generate Reset Password URL
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`

        await sendEmail({
            email: user.email,
            subject: 'Password Reset Request',
            content: `Reset your password using this link: ${resetUrl}. This link expires in 10 minutes.`
        })
        // Send Rest Password URL to the email

        return res.status(200).json({
            status: true,
            message: 'Password reset link sent successfully'
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({
            message: error.message || "Internal server error"
        })
    }
}

async function resetPassword(req, res) {
    try {
 // Validate Schema
        const validation = resetPasswordSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.flatten()
            })
        }

        const { token } = req.params;
        const { newPassword, confirmNewPassword } = req.body;

        const hashedToken = crypto.createHash("sha256").update(token).digest('hex');
        
        const user = await userModel.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        }).select("+password +resetPasswordToken +resetPasswordExpire")

        if (!user) {
            return res.status(400).json({
                status: false,
                message: "Invalid or expired reset token"
            })
        };

        user.password = newPassword;
        user.confirmPassword = confirmNewPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        return res.status(200).json({
            status: true,
            message: "Password reset successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error.message || "Internal server error"
        })
    }
}

module.exports = { signUp, login, getMe, changePassword, forgotPassword, resetPassword };