var config = {};

config.signalling = {
    PORT: 8002,
    SERVER_HB_INTERVAL: 15 * 1000,
    SERVER_HB_VALIDITY: 35 * 1000,
    SENDER_ID: "SignallingServer"
};

module.exports = config;