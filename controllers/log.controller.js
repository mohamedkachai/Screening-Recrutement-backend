const logModel = require('../models/log.model');

async function getLogs(req, res) {
    try {
        const logs = await logModel.find().sort({ createdAt: -1 });

        res.status(200).json({
            logs
        })
    } catch (error) {
        res.status(500).json({
            message: error.message || "Internal Server Error"
        })
    }
};

async function getLogsByActorId(req, res) {
    try {
        const logs = await logModel.find({ actorId: req.params.id });

        res.status(200).json({
            logs
        })
    } catch (error) {
        res.status(500).json({
            message: error.message || "Internal Server Error"
        })
    }
}

module.exports = { getLogs, getLogsByActorId }