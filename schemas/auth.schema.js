const { z } = require('zod');

// Public self-signup: defaults to CANDIDATE; HR/ADMIN/REVIEWER are created by ADMIN via /user/create
const signUpSchema = z.object({
    email: z.string('Email is required').email({ message: "Invalid email format" }),
    firstName: z.string().min(1, { message: "First Name is required" }),
    lastName: z.string().min(1, { message: "Last Name is required" }),
    password: z.string()
        .min(8, { message: "Password must be greater than 8 charcters" })
        .max(32, { message: "Password must be less than 32 charcters" }),
    confirmPassword: z.string()
        .min(8, { message: "Password must be greater than 8 charcters" })
        .max(32, { message: "Password must be less than 32 charcters" }),
    dob: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string('Email is required').email({ message: "Invalid email format" }),
    password: z.string()
        .min(8, { message: "Password must be greater than 8 charcters" })
        .max(32, { message: "Password must be less than 32 charcters" }),
})

const changePasswordSchema = z.object({
    currentPassword: z.string()
        .min(8, { message: "Password must be greater than 8 charcters" })
        .max(32, { message: "Password must be less than 32 charcters" }),
    newPassword: z.string()
        .min(8, { message: "Password must be greater than 8 charcters" })
        .max(32, { message: "Password must be less than 32 charcters" }),
    confirmNewPassword: z.string()
        .min(8, { message: "Password must be greater than 8 charcters" })
        .max(32, { message: "Password must be less than 32 charcters" }),
})

const forgotPasswordSchema = z.object({
    email: z.string('Email is required').email({ message: "Invalid email format" }),
})

const resetPasswordSchema = z.object({
    newPassword: z.string()
        .min(8, { message: "Password must be greater than 8 charcters" })
        .max(32, { message: "Password must be less than 32 charcters" }),
    confirmNewPassword: z.string()
        .min(8, { message: "Password must be greater than 8 charcters" })
        .max(32, { message: "Password must be less than 32 charcters" }),
})

module.exports = { signUpSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema };