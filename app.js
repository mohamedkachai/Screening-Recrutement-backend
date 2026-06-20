const express = require('express');
const userRouter = require('./routes/user.route');
const authRouter = require('./routes/auth.route');
const fileRouter = require('./routes/file.route');
const offerRouter = require('./routes/offer.route');
const applicationRouter = require('./routes/application.route');
const invitationRouter = require('./routes/invitation.route');
const testRouter = require('./routes/test.route');
const sessionRouter = require('./routes/session.route');
const attemptRouter = require('./routes/attempt.route');
const exportRouter = require('./routes/export.route');

const logRouter = require("./routes/log.route");

const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/user', userRouter);
app.use('/auth', authRouter);
app.use('/file', fileRouter);
app.use('/offer', offerRouter);
app.use('/invitations', invitationRouter);
app.use('/application', applicationRouter);
app.use('/test', testRouter);
app.use('/attempt', attemptRouter);
app.use('/session', sessionRouter);
app.use('/export', exportRouter);
app.use('/logs', logRouter);

module.exports = app;