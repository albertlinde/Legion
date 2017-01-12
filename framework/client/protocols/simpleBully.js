function SimpleBully(legion) {
    this.legion = legion;
    var sb = this;
    this.handlers = {
        bully: {
            type: "Bully",
            callback: function (message, connection) {
                var hisID = (message.s).toString();
                var time = Date.now();
                if (hisID <= sb.bully) {
                    sb.bully = hisID;
                    sb.lastBullyMessage = time;
                    sb.bullied();
                    if (typeof bullyLog != "undefined" && bullyLog)console.log("Be bullied by", hisID);
                } else {
                    if (typeof bullyLog != "undefined" && bullyLog)console.log("Be bullied by", hisID, "but mine is", sb.bully);
                    sb.onClientConnection(connection);
                }
            }
        }
    };

    this.bully = (this.legion.id).toString();
    this.lastBullyMessage = Date.now();

    this.bullyMustHaveInterval = this.legion.options.bullyProtocol.options.bullyMustHaveInterval;
    this.bullySendInterval = this.legion.options.bullyProtocol.options.bullySendInterval;
    this.bullyStartTime = this.legion.options.bullyProtocol.options.bullyStartTime;

    setTimeout(function () {
            sb.interval = setInterval(function () {
                sb.floodBully();
            }, sb.bullySendInterval);
        },
        sb.bullyStartTime);

    this.legion.messagingAPI.setHandlerFor(this.handlers.bully.type, this.handlers.bully.callback);
    this.callbacks = [];
}

SimpleBully.prototype.setOnBullyCallback = function (cb) {
    this.callbacks.push(cb);
};

SimpleBully.prototype.bullied = function () {
    var arg = this.amBullied();
    for (var i = 0; i < this.callbacks.length; i++) {
        this.callbacks[i](arg);
    }
};

SimpleBully.prototype.onClientConnection = function (peerConnection) {
    if (peerConnection.remoteID > this.legion.id) {
        this.legion.generateMessage(this.handlers.bully.type, null, function (result) {
            if (typeof bullyLog != "undefined" && bullyLog)console.log("Being immediate bully to", peerConnection.remoteID);
            peerConnection.send(result);
        });
    }
};

SimpleBully.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

SimpleBully.prototype.onServerConnection = function (serverConnection) {
    //No op.
    if (!this.amBullied()) {
        this.floodBully()
    }
};

SimpleBully.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

/**
 * Returns true if node has a bully.
 * False if the node is itself a bully.
 * NOTE: true on startup.
 * @returns {boolean}
 */
SimpleBully.prototype.amBullied = function () {
    if (this.bully == (this.legion.id).toString() || this.bully == "TEMP_ID")
        return false;
    var time = (Date.now()) - this.lastBullyMessage;
    return time <= this.bullyMustHaveInterval;
};

SimpleBully.prototype.floodBully = function () {
    if (!this.amBullied()) {
        this.bullied();
        this.bully = (this.legion.id).toString();
        this.lastBullyMessage = Date.now();

        var sb = this;
        this.legion.generateMessage(this.handlers.bully.type, null, function (result) {
            var peers = sb.legion.overlay.getPeers(sb.legion.overlay.peerCount());

            for (var i = 0; i < peers.length; i++) {
                if (typeof bullyLog != "undefined" && bullyLog)console.log("Being bully to", peers[i].remoteID);
                peers[i].send(result);
            }
        });
    } else {
        if (typeof bullyLog != "undefined" && bullyLog)console.log("My bully", this.bully, this.lastBullyMessage);
    }
};
