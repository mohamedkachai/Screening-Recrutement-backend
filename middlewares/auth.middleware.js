const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');

const protect = async (req, res, next) => {
    try {
        // 1. GEt token from headers
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }

        // 2. Check if token exists
        if (!token) {
            return res.status(401).json({
                status: false,
                message: "Not authorized, no token provided"
            })
        }

        // 3. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Get user related to that token from database (exclude password)
        const user = await userModel.findById(decoded.id).select('-password');

        // 5. Check if user exists
        if (!user) {
            return res.status(401).json({
                status: false,
                message: "User associated with this token doesn't exist"
            })
        }

        // 6. Attach user to request object
        req.user = user;

        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                status: false,
                message: "Invalid Token"
            });
        }

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                status: false,
                message: "Token expired, please login again"
            });
        }

        return res.status(500).json({
            status: false,
            message: "Authentication Failed",
            error: error.message
        })
    }
}

const optionalProtect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            return next();
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.id).select('-password');
        if (user) {
            req.user = user;
        }
    } catch (_) {
        // ignore auth errors — treat as unauthenticated
    }
    next();
};

module.exports = { protect, optionalProtect };