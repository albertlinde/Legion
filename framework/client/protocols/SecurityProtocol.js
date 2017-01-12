/**
 *
 * @param legion
 * @constructor
 */
function SecurityProtocol(legion) {
    this.legion = legion;
    this.keys = new ALMap();
    this.currKey = null;

    this.serverPublicKey = null;

    this.queue = new DS_DLList();
}

SecurityProtocol.prototype.gotServerAuthenticationResult = function (result) {
    //console.log(result);
    if (result.result == "Success") {
        this.keys.set(result.currentKey.id, result.currentKey);
        this.currKey = result.currentKey.id;
        this.serverPublicKey = forge.pki.publicKeyFromAsn1(result.serverPublicKey);

        //TODO: the following creates infinicle if key changes twice in a small timespan.
        while (!this.queue.isEmpty) {
            var a = this.queue.removeFirst();
            a.pc.channel.onmessage({data: a.msg});
        }
    } else {
        console.error("Security check failed.");
    }
};


SecurityProtocol.prototype.getServerAuthenticationChallenge = function () {
    var c = {};
    c.type = "Auth";
    c.client_id = this.legion.id;
    c.clientChallenge = this.legion.id;
    return JSON.stringify(c);
};

/**
 *
 * @param HB
 * @returns {boolean}
 */
SecurityProtocol.prototype.verifySHB = function (HB) {
    var signature = HB.signature;
    if (HB.KeyID >= this.getCurrentKeyID()) {
        if ((Date.now()) - (HB.timestamp + HB.validity) <= 0) {
            var md = forge.md.sha256.create();
            md.update("" + HB.timestamp + HB.ID + HB.KeyID + HB.validity);
            return this.serverPublicKey.verify(md.digest().bytes(), signature);
        } else {
            console.warn("Failed on key validity.");
            return false;
        }
    } else {
        console.warn("Failed on key ID.");
        return false;
    }
};

SecurityProtocol.prototype.getCurrentKeyID = function () {
    return this.currKey;
};

SecurityProtocol.prototype.cipher = function (plain) {
    var currentKey = this.keys.get(this.getCurrentKeyID());

    var cipher = forge.cipher.createCipher('AES-CBC', currentKey.key);
    cipher.start({iv: currentKey.iv});
    cipher.update(forge.util.createBuffer(plain));
    cipher.finish();

    return "7." + currentKey.id + ".7:" + cipher.output.bytes();
};

SecurityProtocol.prototype.decipher = function (msg, pc, old) {
    if (msg[0] != '7' && msg[1] != '.') {
        console.error("Failed on decipher due msg", msg, "from: " + pc.remoteID);
        return;
    }
    var i;
    for (i = 2; msg[i] != '.'; i++) {
    }

    var keyID = parseInt(msg.substring(2, i));
    if (keyID < this.getCurrentKeyID()) {
        console.error("Failed on decipher due KEY", msg, "from: " + pc.remoteID);
        return;
    }
    if (keyID > this.getCurrentKeyID()) {
        this.queue.addLast({msg: old, pc: pc});
        this.legion.join();
        return true;
    }

    var currentKey = this.keys.get(keyID);
    var encr = msg.substring(i + 3);

    var decipher = forge.cipher.createDecipher('AES-CBC', currentKey.key);
    decipher.start({iv: currentKey.iv});
    decipher.update(forge.util.createBuffer(encr));
    decipher.finish();

    return decipher.output.data;
};
