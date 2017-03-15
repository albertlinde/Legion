var ALMap = require('./../shared/ALMap.js').ALMap;
var forge = require('node-forge');
var util = require('util');
var randInt = require('./../shared/Utils.js').randInt;
var Config = require('./config.js');
var storage = require('node-persist');
exports.AuthServer = AuthServer;

function AuthServer(credentials) {
    this.credentials = credentials;

    this.privateKey = forge.pki.privateKeyFromPem("" + credentials.key);
    this.publicKey = forge.pki.publicKeyFromPem("" + credentials.publicKey);

    this.publicKeyString = forge.pki.publicKeyToAsn1(this.publicKey);

    this.keys = new ALMap();
    //TODO: nice way to force new key!
    /*
     var ass = this;
     setInterval(function () {
     var nkid = ass.getCurrentKey().id + 1;
     ass.keys.set(nkid, ass.newKey(nkid));
     }, 25 * 1000);*/
    this.clientCheck = Config.clientCheck;
    this.groupCheck = Config.groupCheck;

    var auth = this;
    storage.initSync({dir: 'keyData'});

    var currentKey = storage.getItemSync("key");
    if (currentKey) {
        util.log("Found a key!");
        var keyID = parseInt(currentKey);
        var key = JSON.parse(storage.getItemSync(currentKey));
        auth.keys.set(keyID, key);
    } else {
        util.log("Found no key.");
        auth.keys.set(1, auth.newKey("1"));
        storage.setItemSync("key", "1");
        storage.setItemSync("1", JSON.stringify(auth.keys.get(1)));
    }
    auth.started = true;
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
        return randInt(5);
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

AuthServer.prototype.verifyClientGroup = function (socket, parsed) {
    var ret = {};
    var gc = this.groupCheck(parsed.client, parsed.group);
    ret.success = gc.success;
    ret.message = gc.message;
    return ret;
};

AuthServer.prototype.verifyClient = function (socket, parsed) {
    var ret = {};
    var cc = this.clientCheck(parsed.client);
    ret.success = cc.success;
    ret.message = cc.message;
    if (cc.success) {
        ret.currentKey = this.getCurrentKey();
        ret.serverPublicKey = this.publicKeyString;
        ret.nodeID = this.getNewNodeID(parsed.client, parsed.group, parsed.nodeID);
    }
    return ret;
};