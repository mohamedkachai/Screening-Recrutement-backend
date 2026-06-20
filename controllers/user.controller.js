const userModel = require('../models/user.model');
const { createUserSchema, updateUserSchema, updateProfileSchema } = require('../schemas/user.schema');
const { saveLog } = require('../utils/logger');

async function createUser(req, res) {
    try {
        const validation = createUserSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.flatten()
            })
        };

        const existingUser = await userModel.findOne({ email: req.body.email });

        if (existingUser) {
            return res.status(400).json({
                status: false,
                message: 'Email already registered'
            })
        }

        // email, firstName, lastName, password, passwordConfirm, dob, role
        const newUser = new userModel({
            ...req.body
        });

        await newUser.save();

        await saveLog({
            action: `${req.user.firstName} has created a new user (${newUser.firstName})`,
            actorId: req.user._id,
        })
        
        res.status(201).json({
            user: newUser,
            message: "User created succesfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        })
    }

}

async function getUser(req, res) {
    try {
        const id = req.params.id;

        const user = await userModel.findById(id);

        if (!user) {
            return res.status(404).json({
                status: false,
                message: "User not found"
            })
        }

        res.status(200).json({
            status: true,
            user: user
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        })
    }
}

async function putUser(req, res) {
    try {
        const id = req.params.id;

        const validation = updateUserSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.flatten()
            })
        };

        const user = await userModel.findById(id);

        if (!user) {
            return res.status(404).json({
                status: false,
                message: "User not found"
            })
        };

        const updatedUser = await userModel.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        })

        await saveLog({
            action: `${req.user.firstName} has updated user ${updatedUser.firstName}`,
            actorId: req.user._id
        })

        res.status(201).json({
            status: true,
            user: updatedUser,
            message: "User Updated Succesfully",
        })

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        })
    }
}

async function deleteUser(req, res) {
    try {

        const id = req.params.id;

        const user = await userModel.findById(id);

        if (!user) {
            return res.status(404).json({
                status: false,
                message: "User not found"
            })
        };

        await userModel.findByIdAndDelete(id);

        await saveLog({
            action: `${req.user.firstName} has deleted user ${user.firstName}`,
            actorId: req.user._id
        })

        res.status(204).json()

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        })
    }
}

async function listUsers(req, res) {
    try {
        const users = await userModel.find();

        return res.status(200).json({
            status: true,
            users
        })
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        })
    }
}

async function updateMyProfile(req, res) {
    try {
        const validation = updateProfileSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.flatten()
            });
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            req.user._id,
            { ...req.body, profileCompleted: true },
            { new: true, runValidators: true }
        );

        await saveLog({
            action: `${req.user.firstName} updated their profile`,
            actorId: req.user._id
        });

        return res.status(200).json({
            status: true,
            user: updatedUser,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
}

module.exports = { createUser, putUser, deleteUser, getUser, listUsers, updateMyProfile };