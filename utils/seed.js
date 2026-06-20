const userModel = require('../models/user.model');
const { ROLES } = require('../models/enums');

async function ensureAdminUser() {
    try {
        const email = (process.env.SEED_ADMIN_EMAIL || 'admin@screening.local').toLowerCase();
        const existing = await userModel.findOne({ email });

        if (existing) {
            return;
        }

        const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

        await userModel.create({
            email,
            firstName: process.env.SEED_ADMIN_FIRST_NAME || 'Platform',
            lastName: process.env.SEED_ADMIN_LAST_NAME || 'Admin',
            password,
            confirmPassword: password,
            role: ROLES.ADMIN,
            profileCompleted: true,
        });

        console.log('---------------------------------------------');
        console.log('[seed] Admin account created');
        console.log(`        email:    ${email}`);
        console.log(`        password: ${password}`);
        console.log('        (change immediately via Profile → Change Password)');
        console.log('---------------------------------------------');
    } catch (error) {
        console.log('[seed] failed to create admin:', error.message);
    }
}

module.exports = { ensureAdminUser };
