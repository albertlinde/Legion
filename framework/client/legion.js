function Legion(options) {
    if (!options) {
        options = {};
    }
    this.options = options;
    this.joined = false;
    this.onJoinCallback = null;

    if (!options.client) {
        options.client = {id: this.randInt(5), secret: this.randInt(5)};
    }
    if (!options.group) {
        options.group = {id: "default", secret: "default"};
    }
    if (!options.overlayProtocol) {
        options.overlayProtocol = {
            type: GeoOptimizedOverlay,
            parameters: {
                locator: HTTPPinger,
                locations: ["https://di.fct.unl.pt", "https://di.fct.unl.pt"],
                MIN_CLOSE_NODES: 3,
                MAX_CLOSE_NODES: 5,
                MIN_FAR_NODES: 1,
                MAX_FAR_NODES: 2,
                CLOSE_NODES_TIMER: 15 * 1000,
                FAR_NODES_TIMER: 55 * 1000,
                LOCAL_FAILS_TILL_RESET: 20
            }
        };
        /*options.overlayProtocol = {
         type: RandomGraphOverlay,
         parameters: {
         meta_interval: 15 * 1000,
         initial_ttl: 3,
         initial_n: 3,
         min: 5,
         max: 7,
         conn_check_timeout: 8 * 1000,
         conn_check_timeout_startup: 20 * 1000,
         conn_check_timeout_multiplier: 1.5,
         RAND_VAL: 0.3
         }
         }*/
    }
    if (!options.messagingProtocol) {
        options.messagingProtocol = FloodMessaging;
    }
    if (!options.objectOptions) {
        options.objectOptions = {
            serverInterval: 5000,
            peerInterval: 10
        };
    }
    if (!options.bullyProtocol) {
        options.bullyProtocol = {
            type: ServerBully
        };
    }
    if (!options.signallingConnection) {
        options.signallingConnection = {
            type: ServerConnection,
            server: {ip: window.location.hostname, port: 443}
        };
    }
    if (!options.objectServerConnection) {
        options.objectServerConnection = {
            type: ObjectServerConnection,
            server: {ip: window.location.hostname, port: 8000}
        };
    }
    if (!options.securityProtocol) {
        options.securityProtocol = SecurityProtocol;
    }

    this.messageCount = this.randInt(5);
    this.id = null;

    this.messagingAPI = new MessagingAPI(this);
    if (this.options.bullyProtocol)
        this.bullyProtocol = new this.options.bullyProtocol.type(this);
    this.overlay = new Overlay(this, this);
    this.connectionManager = new ConnectionManager(this);
    this.objectStore = new ObjectStore(this);

    this.group = options.group;
    this.client = options.client;
}
/**
 * Joins the overlay.
 */
Legion.prototype.join = function () {
    //TODO: why is security being started here?
    this.secure = new this.options.securityProtocol(this);
    this.connectionManager.startSignallingConnection();
};
/**
 *
 * @returns {MessagingAPI}
 */
Legion.prototype.getMessageAPI = function () {
    return this.messagingAPI;
};

/**
 *
 * @returns {ObjectStore}
 */
Legion.prototype.getObjectStore = function () {
    return this.objectStore;
};


/**
 * For generating messages that can be sent.
 * Type is required.
 * @param type {String}
 * @param data {Object}
 * @param callback {Function}
 */
Legion.prototype.generateMessage = function (type, data, callback) {
    var message = {
        type: type,
        s: this.id,
        ID: ++this.messageCount
    };

    if (data) {
        message.data = data;
    }

    callback(message);
};

/**
 * Adds new content to an existing message.
 * Does not override message sender or message id!
 * Will remove existing content (even if no newData is given!).
 * @param oldMessage {{type:String, sender: String, ID: number, content: Object|null}}
 * @param newData {Object|null}
 * @param callback {Function}
 */
Legion.prototype.reGenerateMessage = function (oldMessage, newData, callback) {
    //TODO: this seems like a hammered fix.
    if (!newData) {
        if (oldMessage.data)
            delete oldMessage.data;
    } else {
        oldMessage.data = newData;
    }
    callback(oldMessage);
};

/**
 * Returns a number representation of the local clock.
 * @returns {number}
 */
Legion.prototype.getTime = function () {
    //TODO: this should be fixed.
    return Date.now();
};

/**
 * Returns a random integer.
 * @returns {number}
 */
Legion.prototype.randInt = function (N) {
    //TODO: why does the API export this?
    return Math.floor((Math.random() * Number.MAX_VALUE) % (Math.pow(10, N)));
};

/**
 * Sets a callback which is called when a connection is first established to a signalling server.
 * If a connection has already been made the callback is called immediately.
 * @param callback {Function}
 */
Legion.prototype.onJoin = function (callback) {
    if (this.joined) {
        callback();
    } else {
        this.onJoinCallback = callback;
    }
};

Legion.prototype.onOpenServer = function (serverConnection) {
    //TODO: signalling is seperate from secure and from data.
    //TODO: error on verifying permissions to server.
    if (!this.joined) {
        this.joined = true;
        if (this.onJoinCallback) {
            this.onJoinCallback();
            this.onJoinCallback = null;
        }
    }
};