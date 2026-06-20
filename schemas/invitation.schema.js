const { z } = require('zod');

const createInvitationSchema = z.object({
    email: z.string().email({ message: 'Invalid email format' }),
    offerId: z.string().optional().nullable(),
    message: z.string().max(2000).optional(),
    ttlDays: z.number().int().min(1).max(60).optional(),
});

const acceptInvitationSchema = z.object({
    firstName: z.string().min(1, { message: 'First name is required' }),
    lastName: z.string().min(1, { message: 'Last name is required' }),
    password: z.string().min(8).max(32),
    confirmPassword: z.string().min(8).max(32),
    dob: z.string().optional(),
});

module.exports = { createInvitationSchema, acceptInvitationSchema };
