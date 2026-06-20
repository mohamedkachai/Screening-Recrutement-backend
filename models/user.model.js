const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ROLE_VALUES, ROLES, WORK_MODE_VALUES } = require('./enums');

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true
        },
        firstName: {
            type: String,
            required: [true, 'First Name is required'],
            trim: true
        },
        lastName: {
            type: String,
            required: [true, 'Last Name is required'],
            trim: true
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 chars'],
            select: false
        },
        confirmPassword: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 chars'],
            select: false
        },
        dob: {
            type: Date,
        },
        role: {
            type: String,
            enum: ROLE_VALUES,
            default: ROLES.CANDIDATE
        },
        avatar: {
            type: String
        },
        // Candidate profile fields
        phone: {
            type: String,
            trim: true
        },
        country: {
            type: String,
            trim: true
        },
        address: {
            type: String,
            trim: true
        },
        yearsOfExperience: {
            type: Number,
            min: 0
        },
        skills: {
            type: [String],
            default: []
        },
        linkedinUrl: {
            type: String,
            trim: true
        },
        portfolioUrl: {
            type: String,
            trim: true
        },
        expectedSalary: {
            amount: { type: Number, min: 0 },
            currency: { type: String, default: 'USD', trim: true }
        },
        willingToRelocate: {
            type: Boolean,
            default: false
        },
        workMode: {
            type: String,
            enum: WORK_MODE_VALUES
        },
        cv: {
            type: String
        },
        diplomas: {
            type: [String],
            default: []
        },
        profileCompleted: {
            type: Boolean,
            default: false
        },
        resetPasswordToken: {
            type: String,
            default: null,
            select: false
        },
        resetPasswordExpire: {
            type: Date,
            default: null,
            select: false
        }
    }, { timestamps: true })

userSchema.pre('save', async function () {
    // Only hash on password changes (skip on profile-only updates)
    if (!this.isModified('password')) {
        return;
    }

    if (this.password !== this.confirmPassword) {
        throw new Error("Passwords doesn't match");
    }

    const salt = await bcrypt.genSalt(12);

    this.password = await bcrypt.hash(this.password, salt);

    this.confirmPassword = undefined;
})

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.getResetPasswordToken = function () {
    // Creation token 
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Save Hashed Token to DB
    const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    // return actual token

    return { resetToken, resetPasswordToken, resetPasswordExpire} ;
}

const userModel = mongoose.model('users', userSchema);

module.exports = userModel;