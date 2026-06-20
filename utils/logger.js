const logModel = require('../models/log.model');

async function saveLog(params) {
    try {
        const log = new logModel({
            ...params
        })

        await log.save();

        return log;
    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = { saveLog };