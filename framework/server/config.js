var config = {};

config.signalling = {
    PORT_HTTP: 80,
    PORT_HTTPS: 443,
    SERVER_HB_INTERVAL: 15 * 1000,
    SERVER_HB_VALIDITY: 35 * 1000,
    SENDER_ID: "SS",
    key: "./keys/key.pem",
    cert: "./keys/cert.pem",
    public_key: "./keys/public_key.pem"
};

config.objectsServer = {
    PORT: 8000,
    key: "./keys/key.pem",
    cert: "./keys/cert.pem"
};

module.exports = config;