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

app.get('/', function (req, res, next) {
    util.log("Got index.html");
    res.sendFile(path.resolve('./../../applications/examples/index.html'));
});

//Static files.
var static_files = [
    ["/node_modules", express.static(path.resolve('./../../node_modules'))],
    ["/applications", express.static(path.resolve('./../../applications/'))],
    ["/applications/examples", express.static(path.resolve('./../../applications/examples'))],
    ["/img", express.static(path.resolve('./../../applications/examples/img'))]
];
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
    return true;
    //TODO
}

var killClientConnection = function (socket, err, thrown_event, original_message) {
    //TODO: check error, log, remove the client, block the client.
    util.log("Killing a client: " + socket.client.id);
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

    wss.on('connection', function (socket) {
            util.log("Connection.");
            socket.on('message',
                function incoming(original) {
                    var parsed;
                    try {
                        parsed = JSON.parse(original);
                    } catch (error) {
                        killClientConnection(socket, "JSON parse failed.", null, original);
                        return;
                    }

                    if (!initialIntegrityCheck(parsed)) {
                        killClientConnection(socket, "Failed on initial integrity check.", error, original);
                        return;
                    }

                    if (duplicates.contains(parsed.s, parsed.ID)) {
                        util.log(" : d " + parsed.type + ".");
                        return;
                    }

                    duplicates.add(parsed.s, parsed.ID);
                    util.log(" : " + parsed.type + ".");

                    if (parsed.type == "Auth") {
                        var auth = authority.verifyClient(socket, parsed);
                        util.log("Got Auth from " + JSON.stringify(parsed.client) + " : " + JSON.stringify(auth.success));
                        if (auth.success) {
                            socket.authSuccess = true;
                            socket.client = parsed.client;
                            groupsManager.addClient(socket);
                        }
                        var authMessage = generateMessage("AuthResponse");
                        authMessage.auth = auth;
                        socket.send(JSON.stringify(authMessage));
                    } else {
                        if (!socket.authSuccess) {
                            killClientConnection(socket, "Client attempted things before auth.", null, original);
                            return;
                        }

                        if (parsed.group) {
                            util.log("   Group: -> " + JSON.stringify(parsed.group));
                            var group = groupsManager.getGroup(parsed.group);
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
                            console.error("correct client, no group");
                            console.error(parsed);
                        }
                    }
                }
            );
            socket.on('close', function () {
                util.log("Disconnected " + socket.client.id);
                groupsManager.removeClient(socket);
            });
        }
    )
}