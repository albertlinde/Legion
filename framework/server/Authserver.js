var ALMap = require('./../shared/ALMap.js').ALMap;
var forge = require('node-forge');
var util = require('util');
var Config = require('./config.js');

exports.AuthServer = AuthServer;

function AuthServer(credentials) {
    this.credentials = credentials;

    this.privateKey = forge.pki.privateKeyFromPem("" + credentials.key);
    this.publicKey = forge.pki.publicKeyFromPem("" + credentials.publicKey);

    this.publicKeyString = forge.pki.publicKeyToAsn1(this.publicKey);

    this.keys = new ALMap();
    //TODO: ids of keys can't start at 1 every time the server is re-booted!
    //TODO: nice way to force new key!
    this.keys.set(1, this.newKey(1));
    /*
     var ass = this;
     setInterval(function () {
     var nkid = ass.getCurrentKey().id + 1;
     ass.keys.set(nkid, ass.newKey(nkid));
     }, 25 * 1000);*/
    this.clientCheck = Config.clientCheck;
    this.groupCheck = Config.groupCheck;
}

AuthServer.prototype.getCurrentKey = function () {
    return this.getKey(this.keys.size());
};

AuthServer.prototype.getKey = function (keyID) {
    return this.keys.get(keyID);
};

AuthServer.prototype.newKey = function (keyID) {
    //TODO: parameterizable
    util.log("New key: " + keyID);
    var key = {};
    key.id = keyID;
    key.key = forge.random.getBytesSync(16);
    key.iv = forge.random.getBytesSync(16);
    return key;
};

AuthServer.prototype.getNewNodeID = function (clientID, group, nodeID) {
    if (nodeID) {
        return nodeID;
    } else {
        return this.randInt(5);
    }
};

/**
 * @param c
 * @returns {{auth: {}}}
 */
AuthServer.prototype.verify = function (c) {
    var ret = {auth: {}};
    if (c.type != "Auth" || !this.clientCheck(c.client) || !this.groupCheck(c.client, c.group))
        ret.result = "Failed";
    else {
        ret.auth.result = "Success";
        ret.auth.currentKey = this.getCurrentKey();
        ret.auth.serverPublicKey = this.publicKeyString;
        ret.auth.nodeID = this.getNewNodeID(c.client, c.group, c.nodeID);
    }
    return ret;
};

AuthServer.prototype.signedMessageDigest = function (string) {
    var md = forge.md.sha256.create();
    md.update(string);
    return this.privateKey.sign(md);
};

/**
 * Returns a random integer.
 * @returns {number}
 */
AuthServer.prototype.randInt = function (N) {
    //TODO: why is this here?
    return Math.floor((Math.random() * Number.MAX_VALUE) % (Math.pow(10, N)));
};
