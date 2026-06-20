const { ROLES } = require('../models/enums');

/**
 * Role gate middleware. Must be used AFTER `protect`.
 * Usage: router.post('/x', protect, authorize(ROLES.ADMIN, ROLES.HR), handler)
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: false,
                message: 'Not authorized, no user on request'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                status: false,
                message: 'Forbidden: insufficient permissions'
            });
        }

        next();
    };
}

module.exports = { authorize, ROLES };
