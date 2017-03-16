/**
 * Used to cut messages sent by PeerConnections in to pieces when necessary.
 * Re-constructs on the receiving end.
 * @param pc {PeerConnection}
 * @constructor
 */
function MessageCutter(pc) {
    this.sending = {};
    this.receiving = {};
    this.pc = pc;
    this.maxSize = 15 * 1024;
    this.warned = false;
    this.log = false;
    this.logD = false;
}

/**
 * Sends a string.
 * String is cut to pieces and re-built on the other end if needed.
 * @param string {String}
 */
MessageCutter.prototype.sendMessage = function (string) {
    var msgId = randInt(3);
    if (string.length < this.maxSize) {
        var final = msgId + ":1:1:" + string;
        this.sending[msgId] = [msgId, final, 1];
        this.pc.sendReallyToSocket(final);
    } else {
        if (!this.warned) {
            this.warned = true;
            console.warn("Sending big messages. Cutting enabled.");
        }
        var data = [];
        data[0] = msgId;
        var msgCount = Math.ceil(string.length / this.maxSize);
        if (this.log) console.warn("sending cut message: ", msgId, msgCount);
        for (var i = 1; i <= msgCount; i++) {
            data[i] = msgId + ":" + i + ":" + msgCount + ":" + string.substring((i - 1) * this.maxSize, (i) * this.maxSize);
        }
        this.sending[msgId] = [msgId, data, msgCount];
        for (var j = 1; j <= msgCount; j++) {
            if (this.log) console.warn("sending cut message part: ", j, data[j]);
            this.pc.sendReallyToSocket(data[j]);
        }
    }
};

/**
 * Call with each cut piece from network.
 * Re-builds pieces and channel.onFullMessage with the end result.
 * @param data {string}
 */
MessageCutter.prototype.receivedPartial = function (data) {
    if (data.startsWith("0")) {
        this.receivedControl(data);
    } else {
        var first = data.indexOf(":");
        var second = data.indexOf(":", first + 1);
        var third = data.indexOf(":", second + 1);
        var msgId = parseInt(data.substring(0, first));
        var msgPartId = parseInt(data.substring(first + 1, second));
        var msgParts = parseInt(data.substring(second + 1, third));
        var msg = data.substring(third + 1);
        if (this.logD) console.log(msgId, msgPartId, msgParts, msg);

        if (msgParts == 1) {
            this.sendAck(msgId, msgPartId);
            this.pc.onFullMessage(msg);
        } else {
            this.sendAck(msgId, msgPartId);
            if (!this.warned) {
                this.warned = true;
                console.warn("Sending big messages. Cutting enabled.");
            }
            var rcvMsg = this.receiving[msgId];
            if (!rcvMsg) {
                rcvMsg = {};
                rcvMsg.msgParts = msgParts;
                rcvMsg.got = 0;
                this.receiving[msgId] = rcvMsg;
            }
            rcvMsg.got++;
            rcvMsg[msgPartId] = msg;
            if (this.log) console.warn("received cut message part: ", msgPartId);
            if (rcvMsg.got >= rcvMsg.msgParts) {
                this.tryFinish(msgId);
            }
        }
    }
};

/**
 *
 * @param id {number}
 */
MessageCutter.prototype.tryFinish = function (id) {
    var received = this.receiving[id];
    if (received) {
        var msg = "";
        for (var i = 1; i <= received.msgParts; i++) {
            if (this.logD) console.warn(" have: ", id, i, received[i]);
            if (!received[i]) {
                if (this.log) console.warn("send req for: ", id, i, received[i]);
                this.request(id, i);
                return;
            }
            msg += received[i];
        }
        delete this.receiving[id];
        this.pc.onFullMessage(msg);
    }
};

/**
 *
 * @param string {string}
 */
MessageCutter.prototype.receivedControl = function (string) {
    var first = string.indexOf(":");
    var second = string.indexOf(":", first + 1);
    var command = string.substring(0, first);
    var msgId = parseInt(string.substring(first + 1, second));
    var msgPartId = parseInt(string.substring(second + 1));
    if (this.logD) console.log(command, msgId, msgPartId, string);

    var msg = this.sending[msgId];
    if (msg) {
        if (command == "0ack") {
            if (msg[1][msgPartId]) {
                msg[1][msgPartId] = false;
                msg[2] -= 1;
                if (msg[2] == 0) {
                    delete this.sending[msgId];
                }
            }
        } else if (command == "0req") {
            this.pc.sendReallyToSocket(msg[1][msgPartId]);
        } else {
            console.error("Wrong cutter control message.");
        }
    } else {
        console.warn("Command for removed message.");
    }
};

/**
 *
 * @param msgId {number}
 * @param partId {number}
 */
MessageCutter.prototype.request = function (msgId, partId) {
    this.pc.sendReallyToSocket("0req" + ":" + msgId + ":" + partId);
};

/**
 *
 * @param msgId {number}
 * @param partId {number}
 */
MessageCutter.prototype.sendAck = function (msgId, partId) {
    this.pc.sendReallyToSocket("0ack" + ":" + msgId + ":" + partId);
};