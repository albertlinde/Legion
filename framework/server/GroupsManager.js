var ALMap = require('./../shared/ALMap.js').ALMap;
var forge = require('node-forge');
var util = require('util');
var Config = require('./config.js');
var Group = require('./Group.js').Group;

exports.GroupsManager = GroupsManager;

function GroupsManager(options, generateMSG, auth) {
    if (options)
        this.options = options;
    else
        this.options = {};

    if (typeof this.options.create == "undefined") {
        this.options.create = true; //create any groups
    }

    if (typeof this.options.id == "undefined") {
        this.options.id = function (id) {
            return true; //groups can have any id
        }
    }

    if (typeof this.options.secret == "undefined") {
        this.options.secret = function (secret) {
            return true; //no restrictions on secret
        }
    }

    if (typeof this.options.crdts == "undefined") {
        this.options.crdts = {
            permitted: function (id, type) {
                return true; //any objects are allowed
                // for each (id,type) returning true, client-side can create that additional object.
            }
        }
    }

    //TODO: protocols

    this.groups = new ALMap();
    this.clients = new ALMap();

    this.generateMSG = generateMSG;
    this.auth = auth;
}

GroupsManager.prototype.addGroup = function (socket, groupDetails) {
    if (!socket) {
        if (this.getGroup(groupDetails)) {
            return "Group already exists.";
        } else {
            var g = this.createNewGroup(groupDetails);
            util.log("   Created group with id " + groupDetails.id);
            this.groups.set(g.id, g);
            return g;
        }
    } else if (this.options.create && this.canCreate(groupDetails, socket.client)) {
        if (this.getGroup(groupDetails)) {
            return "Group already exists.";
        } else {
            var g = this.createNewGroup(groupDetails);
            util.log("   Created group with id " + groupDetails.id);
            this.groups.set(g.id, g);
            return g;
        }
    } else {
        return "Permission denied.";
    }
};

/**
 * Assumes all checks are done.
 * @param groupDetails
 * @returns {Group}
 */
GroupsManager.prototype.createNewGroup = function (groupDetails) {
    return new Group(groupDetails);
};

GroupsManager.prototype.canCreate = function (groupDetails, clientDetails) {
    return true;
    //TODO: per application per client group creation restrictions.
};

/**
 *
 * @param groupDetails
 * @returns {Object}
 */
GroupsManager.prototype.getGroup = function (groupDetails) {
    return this.groups.get(groupDetails.id);
};

GroupsManager.prototype.addClient = function (socket) {
    this.clients.set(socket.client.id, socket);
    socket.groups = new ALMap();
};

GroupsManager.prototype.removeClient = function (socket) {
    var gs = socket.groups.keys();
    for (var i = 0; i < gs.length; i++) {
        var g = this.groups.get(gs[i]);
        g.removeClient(socket);
    }
    this.clients.delete(socket.client.id);
};

GroupsManager.prototype.canJoin = function (groupDetails, clientDetails) {
    return true;
    //TODO: per application per group per client group join restrictions.
};

GroupsManager.prototype.clientInGroup = function (groupDetails, clientDetails) {
    return true;
    //TODO:
};

GroupsManager.prototype.sendHB = function () {
    if (!this.auth.started) return;
    var HB = this.generateMSG("SHB");
    HB.timestamp = Date.now();
    HB.validity = Config.signalling.SERVER_HB_VALIDITY;
    HB.KeyID = this.auth.getCurrentKey().id;
    HB.signature = this.auth.signedMessageDigest("" + HB.timestamp + HB.ID + HB.KeyID + HB.validity);
    var msg = JSON.stringify(HB);

    util.log("HB time: [" + HB.timestamp + ", " + (HB.timestamp + HB.validity) + "]");

    var keys = this.groups.keys();
    for (var i = 0; i < keys.length; i++) {
        this.groups.get(keys[i]).sendHB(msg);
    }
    this.lastHB = msg;
};
