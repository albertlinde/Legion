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
    this.temp = {};
    this.log = false;
}

SecurityProtocol.prototype.gotServerAuthenticationResult = function (auth, connection) {
    //console.log(result);
    if (auth.success == true && !(connection instanceof PeerConnection)) {
        if (!this.legion.id) {
            this.legion.id = auth.nodeID;
            console.log("Got new nodeID: " + auth.nodeID);
        } else {
            if (this.legion.id != auth.nodeID) {
                console.error("Got new nodeID: " + auth.nodeID);
                return;
            }
        }

        if (!this.keys.contains(auth.currentKey.id)) {
            console.log("Got new key: " + auth.currentKey.id + " from " + connection.remoteID + ".");
            this.keys.set(auth.currentKey.id, auth.currentKey);
            this.currKey = auth.currentKey.id;
            this.serverPublicKey = forge.pki.publicKeyFromAsn1(auth.serverPublicKey);

            //TODO: the following creates infinicle if key changes twice in a small timespan.
            while (!this.queue.isEmpty) {
                var a = this.queue.removeFirst();
                a.pc.channel.onmessage({data: a.msg});
            }
        }
    } else {
        console.error("Security check failed on server.");
    }
};


SecurityProtocol.prototype.getServerAuthenticationChallenge = function () {
    var c = {};
    c.type = "Auth";
    c.client = this.legion.client;
    if (this.legion.id) {
        c.nodeID = this.legion.id;
    }
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

    return "7." + currentKey.id + ".7:" + cipher.output.bytes() + "7..7";
};

SecurityProtocol.prototype.decipher = function (msg, pc, old) {
    if (
        (msg[0] == '7' && msg[1] == '.')
        &&
        (msg[msg.length - 4] == "7"
        &&
        msg[msg.length - 3] == "."
        &&
        msg[msg.length - 2] == "."
        &&
        msg[msg.length - 1] == "7")
    ) {
        if (this.log) console.log("MC: First and last.");
    } else {
        console.error("Message cutting failed!");
        if (msg[msg.length - 4] == "7" && msg[msg.length - 3] == "." && msg[msg.length - 2] == "." && msg[msg.length - 1] == "7") {
            msg = this.temp[pc.remoteID] + msg;
            this.temp[pc.remoteID] = "";
            if (this.log) console.log("MC: Last.");
        } else if (msg[0] == '7' && msg[1] == '.') {
            if (this.log) console.log("MC: First.");
            this.temp[pc.remoteID] = msg;
            return true;
        } else {
            if (this.log) console.log("MC: Intermediate.");
            this.temp[pc.remoteID] = this.temp[pc.remoteID] + msg;
            return true;
        }
    }

    var i;
    for (i = 2; msg[i] != '.'; i++) {
    }

    var keyID = msg.substring(2, i);
    if (keyID < this.getCurrentKeyID()) {
        console.error("Failed on decipher due KEY", "from: " + pc.remoteID);
        return;
    }
    if (!(this.getCurrentKeyID() === keyID)) {
        this.queue.addLast({msg: "7." + keyID + ".7:" + msg + "7..7", pc: pc});
        console.error("Key failed: " + keyID);
        this.legion.join();
        return true;
    }

    var currentKey = this.keys.get(keyID);
    if (this.log) console.log(currentKey);
    var encr = msg.substring(i + 3, msg.length - 4);

    var decipher = forge.cipher.createDecipher('AES-CBC', currentKey.key);
    decipher.start({iv: currentKey.iv});
    decipher.update(forge.util.createBuffer(encr));
    decipher.finish();

    return decipher.output.data;
};
