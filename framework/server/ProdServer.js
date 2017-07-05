var express = require('express');
var helmet = require('helmet');
var url = require('url');
var path = require('path');
var http = require('http');
var https = require('https');

var fs = require('fs');

var Config = require('./config.js');

var privateKey = fs.readFileSync(Config.signalling.key);
var certificate = fs.readFileSync(Config.signalling.cert);
var publicKey = fs.readFileSync(Config.signalling.public_key);

var credentials = {key: privateKey, cert: certificate, publicKey: publicKey};

var app = express();
var httpApp = express();

app.use(helmet());

var http_port = Config.signalling.PORT_HTTP;
var https_port = Config.signalling.PORT_HTTPS;

var httpServer = http.createServer(httpApp);
var httpsServer = https.createServer(credentials, app);

app.use(function log(req, res, next) {
    util.log([req.method, req.url].join(' '));
    next();
});

app.use(function (req, res, next) {
    if (!req.secure) {
        util.log("- - SECURITY ISSUE: " + req.secure);
        util.log(JSON.stringify(req.headers));
        util.log("- - SECURITY END");
        res.end();
    }
    next();
});

//Static routes.
var static_routes = Config.routes;
for (var i = 0; i < static_routes.length; i++) {
    (function (i) {
        app.get(static_routes[i][0], function (req, res, next) {
            static_routes[i][2]();
            res.sendFile(path.resolve(static_routes[i][1]));
        });
    })(i);
}

//Static files.
var static_files = Config.statics;
for (var i = 0; i < static_files.length; i++) {
    app.use(static_files[i][0], static_files[i][1]);
}

//Last resort.
app.use(function (req, res, next) {
    res.send({code: "404", msg: "File not found."});
});

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({
    server: httpsServer,
    verifyClient: function (info, cb) {
        util.log("Verify Origin: " + "(HTTP" + info.req.httpVersion + "-" + info.req.method + ") " + info.origin + info.req.url);
        util.log("Verify Secure: " + (info.secure && info.req.upgrade));
        util.log("Verify Agent: " + info.req.headers["user-agent"]);
        cb(true);
    }
});

httpApp.get("*", function (req, res, next) {
    util.log("Redirecting " + req.headers.host + req.path + " to HTTPS.");
    res.redirect("https://" + req.headers.host + req.path);
});

httpServer.listen(http_port, function () {
    util.log('HTTP listening on ' + httpServer.address().port);
});

httpsServer.listen(https_port, function () {
    util.log('HTTPS listening on ' + httpsServer.address().port)
});

var Duplicates = require('./../shared/Duplicates.js').Duplicates;

var util = require('util');
var ALMap = require('./../shared/ALMap.js').ALMap;
var AuthServer = require('./Authserver.js').AuthServer;
var GroupsManager = require('./GroupsManager.js').GroupsManager;
var Group = require('./Group.js').Group;

initService();

function initialIntegrityCheck(parsed) {
    return (
            parsed.type &&
            parsed.group && parsed.group.id &&
            parsed.s &&
            parsed.ID
        ) ||
        (
            parsed.type == "Auth" &&
            parsed.client && parsed.client.id && parsed.client.secret
        );

}

var killClientConnection = function (socket, err, thrown_event, original_message) {
    //TODO: check error, log, remove the client, block the client.
    util.log("Killing a client.");
    util.log(err);
    socket.close();
};

function initService() {

    var duplicates = new Duplicates();

    //TODO: on server re-boot message generation breaks.
    var messageCount = 0;

    /**
     *
     * @param type {string}
     * @returns {{type: string, s: string, ID: number}}
     */
    var generateMessage = function (type) {
        return {
            type: type,
            s: Config.signalling.SENDER_ID,
            ID: ++messageCount
        };
    };

    var authority = new AuthServer(credentials);

    //TODO: well defined security and parameters
    setInterval(function () {
        //TODO: send a HB to each first client.
        groupsManager.sendHB();
    }, Config.signalling.SERVER_HB_INTERVAL);

    var options = {};

    var groupsManager = new GroupsManager(options, generateMessage, authority);
    var defaultGroup = {
        id: "default",
        secret: "default",
        crdts: {
            permitted: function (id, type) {
                return false; //no more objects for the example/index page.
            },
            lists: ["list_1", "list_2", "list_3"],
            maps: ["map_1", "map_2", "map_3"],
            sets: ["set_1", "set_2", "set_3"],
            counters: ["counter_1", "counter_2", "counter_3"]
        }
    };
    groupsManager.addGroup(null, defaultGroup);
    groupsManager.sendHB();

    var log = false;
    wss.on('connection', function (socket) {
            util.log("Connection.");
            socket.on('message',
                function incoming(original) {
                    var parsed;
                    try {
                        parsed = JSON.parse(original);
                    } catch (error) {
                        killClientConnection(socket, "JSON parse failed.", error, original);
                        return;
                    }

                    if (!initialIntegrityCheck(parsed)) {
                        killClientConnection(socket, "Failed on initial integrity check.", null, original);
                        return;
                    }

                    if (parsed.s) {
                        if (duplicates.contains(parsed.s, parsed.ID)) {
                            util.log(" : d " + parsed.type + ".");
                            return;
                        }
                        duplicates.add(parsed.s, parsed.ID);
                        if (log) util.log(" : " + parsed.type + " from " + parsed.s + " : " + JSON.stringify(socket.client));
                    } else if (parsed.client) {
                        if (log) util.log(" : " + parsed.type + " from " + JSON.stringify(parsed.client));
                    }

                    if (parsed.type == "Auth") {
                        var auth = authority.verifyClient(socket, parsed);
                        util.log("Got Auth from " + JSON.stringify(parsed.client) + " : " + JSON.stringify(auth.success));
                        if (auth.success) {
                            socket.authSuccess = true;
                            socket.client = auth.nodeID;

                            groupsManager.addClient(socket);
                        }
                        var authMessage = generateMessage("AuthResponse");
                        authMessage.auth = auth;
                        socket.send(JSON.stringify(authMessage));
                    } else {
                        if (!socket.authSuccess) {
                            killClientConnection(socket, "Client attempted things before auth success.", null, original);
                            return;
                        }

                        if (parsed.group) {
                            var g_auth = authority.verifyClientGroup(socket, parsed);
                            if (!g_auth.success) {
                                var g = generateMessage("AuthResponse");
                                g.auth = g_auth;
                                socket.send(JSON.stringify(g));
                                return;
                            }
                            var group = groupsManager.getGroup(parsed.group);
                            if (!group)
                                util.log("   No Group: -> " + JSON.stringify(parsed.group));
                            else if (group.log) {
                                util.log("    Group: -> " + JSON.stringify(parsed.group));
                            }
                            if (group) {
                                group.handleMessage(socket, parsed, original);
                            } else {
                                if (parsed.type == "CreateGroup") {
                                    util.log("   Creating new Group.");
                                    group = groupsManager.addGroup(socket, parsed.group);
                                    if (group && group instanceof Group) {
                                        group.handleMessage(socket, parsed, original);
                                    } else {
                                        util.log("   Group not created.");
                                        var noCreateMessage = generateMessage("NoGroupCreated");
                                        noCreateMessage.message = group;
                                        socket.send(JSON.stringify(noCreateMessage));
                                    }
                                } else {
                                    util.log("   Group does not exist.");
                                    group = groupsManager.addGroup(socket, parsed.group);
                                    if (group && group instanceof Group) {
                                        group.handleMessage(socket, parsed, original);
                                    } else {
                                        var noGroupMessage = generateMessage("NoGroup");
                                        noGroupMessage.group = parsed.group;
                                        socket.send(JSON.stringify(noGroupMessage));
                                    }
                                }
                            }
                        } else {
                            killClientConnection(socket, "Correct client, no group.", null, original);
                        }
                    }
                }
            );
            socket.on('close', function () {
                if (socket.client && socket.client.id)
                    util.log("Disconnected " + socket.client.id);
                else
                    util.log("Disconnected.");
                groupsManager.removeClient(socket);
            });
        }
    )
}