var ALMap = require('./../shared/ALMap.js').ALMap;
var forge = require('node-forge');
var util = require('util');

exports.AuthServer = AuthServer;

function AuthServer(credentials) {
    this.credentials = credentials;

    this.privateKey = forge.pki.privateKeyFromPem("" + credentials.key);
    this.publicKey = forge.pki.publicKeyFromPem("" + credentials.publicKey);

    this.publicKeyString = forge.pki.publicKeyToAsn1(this.publicKey);

    this.keys = new ALMap();
    //TODO: ids of keys can't start at 1 every time the server is re-booted!
    this.keys.set(1, this.newKey(1));
    var ass = this;
    /*setInterval(function () {
        var nkid = ass.getCurrentKey().id + 1;
        ass.keys.set(nkid, ass.newKey(nkid));
    }, 25 * 1000);*/
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

AuthServer.prototype.clientCheck = function (client_id) {
    //TODO: programmer-defined. the id alone is not enough
    return true;
    return parseInt(client_id) > 0 && parseInt(client_id) < 10;
};

AuthServer.prototype.verify = function (c) {
    //TODO: see (clientCheck)
    var ret = {auth: {}};

    if (c.type != "Auth" || c.client_id != c.clientChallenge || !this.clientCheck(c.client_id))
        ret.result = "Failed";
    else {
        ret.auth.result = "Success";
        ret.auth.currentKey = this.getCurrentKey();
        ret.auth.serverPublicKey = this.publicKeyString;
    }
    return ret;
};
AuthServer.prototype.signedMessageDigest = function (string) {
    var md = forge.md.sha256.create();
    md.update(string);
    return this.privateKey.sign(md);
};

