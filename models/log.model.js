const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    action: {
        type: String
    },
    actorId: {
        type: String
    },
}, { timestamps: true });

const logModel = mongoose.model("logs", logSchema);

module.exports = logModel;