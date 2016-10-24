function GDriveRTSecurityProtocolServerConnection(legion) {
    this.legion = legion;
    this.lru = legion.lru;

    this.keys = new ALMap();
    this.currKey = null;
    this.keyRequest();

    this.queue = new DS_DLList();
}


GDriveRTSecurityProtocolServerConnection.prototype.keyRequest = function () {
    if (this.legion.connectionManager.serverConnection &&
        this.legion.connectionManager.serverConnection.isAlive()) {
        //no op. signalling file updates my key.
        if (this.document)
            this.document.close();//confirm this is closed.
    } else {
        if ((!this.document || this.document.isClosed) && this.lru.FileID_KeyList) {
            var sc = this;

            this.lru.realtimeUtils.load(this.lru.FileID_KeyList.replace('/', ''), function (doc) {
                sc.model = model;
                sc.keyList = sc.document.getModel().getRoot().get('b2b_map');
                sc.keyRequest();

                sc.document = doc;
                sc.keyRequest();

            }, function (model) {
                console.error("This should have been done already.");
                //model.getRoot().set("keyList", model.createList());
            });
        } else {
            if (this.currKey) {
                for (var i = this.currKey.id; i < this.keyList.size(); i++) {
                    this.keys.set(i, this.keyList.get(i));
                }

                this.document.close();

                if (this.keys.size() > this.currKey.id) {
                    this.currKey = this.keys.get(this.keys.size());

                    while (!this.queue.isEmpty) {
                        var a = this.queue.removeFirst();
                        a.pc.channel.onmessage({data: a.msg});
                    }
                } else {
                    console.error("Security check failed.")
                }
            }
        }
    }
};

GDriveRTSecurityProtocolServerConnection.prototype.gotServerAuthenticationResult = function (result) {
    console.log(result);
    if (result.result == "Success") {
        this.keys.set(result.currentKey.id, result.currentKey);
        this.currKey = result.currentKey;
        this.serverPublicKey = forge.pki.publicKeyFromAsn1(JSON.parse(result.serverPublicKey));

        //TODO: the following creates infinicle if key changes twice in a small timespan.
        while (!this.queue.isEmpty) {
            var a = this.queue.removeFirst();
            a.pc.channel.onmessage({data: a.msg});
        }
    } else {
        console.error("Security check failed.")
    }
};

GDriveRTSecurityProtocolServerConnection.prototype.getServerAuthenticationChallenge = function () {
    var c = {};
    c.type = "Auth";
    c.client_id = 1;
    c.clientChallenge = 1;
    return JSON.stringify(c);
};

GDriveRTSecurityProtocolServerConnection.prototype.setKey = function (key) {
    if (!this.currKey || this.currKey.id < key.id) {
        this.currKey = key;
    }
    this.keys.set(key.id, key);
    while (!this.queue.isEmpty) {
        var a = this.queue.removeFirst();
        a.pc.channel.onmessage({data: a.msg});
    }
};

GDriveRTSecurityProtocolServerConnection.prototype.getCurrentKeyID = function () {
    return this.currKey.id;
};

GDriveRTSecurityProtocolServerConnection.prototype.cipher = function (plain) {

    var cipher = forge.cipher.createCipher('AES-CBC', this.currKey.key);
    cipher.start({iv: this.currKey.iv});
    cipher.update(forge.util.createBuffer(plain));
    cipher.finish();

    return "7." + this.currKey.id + ".7:" + cipher.output.bytes();
};

GDriveRTSecurityProtocolServerConnection.prototype.decipher = function (msg, pc, old) {
    if (msg[0] != '7' && msg[1] != '.') {
        return;
    }
    var i;
    for (i = 2; msg[i] != '.'; i++) {
    }

    var keyID = parseInt(msg.substring(2, i));
    if (keyID < this.getCurrentKeyID())
        return;
    if (keyID > this.getCurrentKeyID()) {
        this.queue.addLast({msg: old, pc: pc});
        this.keyRequest();
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
