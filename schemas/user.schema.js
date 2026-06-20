const { z } = require('zod');
const { ROLE_VALUES, WORK_MODE_VALUES } = require('../models/enums');

const candidateProfileFields = {
    phone: z.string().trim().min(1).optional().nullable(),
    country: z.string().trim().min(1).optional().nullable(),
    address: z.string().trim().min(1).optional().nullable(),
    yearsOfExperience: z.number().min(0).optional().nullable(),
    skills: z.array(z.string()).optional(),
    linkedinUrl: z.string().url({ message: 'Invalid LinkedIn URL' }).optional().nullable(),
    portfolioUrl: z.string().url({ message: 'Invalid portfolio URL' }).optional().nullable(),
    expectedSalary: z
        .object({
            amount: z.number().min(0),
            currency: z.string().min(1).default('USD'),
        })
        .optional()
        .nullable(),
    willingToRelocate: z.boolean().optional(),
    workMode: z.enum(WORK_MODE_VALUES).optional().nullable(),
    cv: z.string().optional().nullable(),
    diplomas: z.array(z.string()).optional(),
};

const createUserSchema = z.object({
    email: z.string('Email is required').email({ message: 'Invalid email format' }),
    firstName: z.string().min(1, { message: 'First Name is required' }),
    lastName: z.string().min(1, { message: 'Last Name is required' }),
    password: z.string()
        .min(8, { message: 'Password must be greater than 8 chars' })
        .max(32, { message: 'Password must be less than 32 chars' }),
    confirmPassword: z.string()
        .min(8, { message: 'Password must be greater than 8 chars' })
        .max(32, { message: 'Password must be less than 32 chars' }),
    dob: z.string().optional(),
    role: z.enum(ROLE_VALUES),
    avatar: z.string().optional().nullable(),
    ...candidateProfileFields,
});

const updateUserSchema = z.object({
    email: z.string('Email is required').email({ message: 'Invalid email format' }),
    firstName: z.string().min(1, { message: 'First Name is required' }),
    lastName: z.string().min(1, { message: 'Last Name is required' }),
    dob: z.string().optional(),
    role: z.enum(ROLE_VALUES),
    avatar: z.string().optional().nullable(),
    ...candidateProfileFields,
});

// Self-update — candidate cannot change their own role
const updateProfileSchema = z.object({
    firstName: z.string().min(1, { message: 'First Name is required' }),
    lastName: z.string().min(1, { message: 'Last Name is required' }),
    dob: z.string().optional(),
    avatar: z.string().optional().nullable(),
    ...candidateProfileFields,
});

module.exports = { createUserSchema, updateUserSchema, updateProfileSchema };
