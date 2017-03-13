var config = {};

config.signalling = {
    PORT_HTTP: 80,
    PORT_HTTPS: 443,
    SERVER_HB_INTERVAL: 45 * 1000,
    SERVER_HB_VALIDITY: 300 * 1000,
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

/**
 *
 * @param client {{id: {string}, secret: {string}}}
 * @returns {Object}
 */
config.clientCheck = function (client) {
    //TODO: programmer-defined.
    return {success: true, message: "Done."};
};

/**
 *
 * @param client {{id: {string}, secret: {string}}}
 * @param group {{id: {string}, secret: {string}}}
 * @returns {Object}
 */
config.groupCheck = function (client, group) {
    //TODO: programmer-defined.
    return {success: true, message: "Done."};
};

module.exports = config;