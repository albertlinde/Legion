function MainBullyProtocol(lru) {
    this.lru = lru;
    this.id = lru.legion.id;

    this.bossTime = 45 * 1000;
    this.renewTime = 20 * 1000;

    this.MainBullyMap = null;
}

MainBullyProtocol.prototype.setSelfAsMainBully = function () {
    this.MainBullyMap.set("Main", {id: this.id, start: ServerDate + 0, end: ServerDate + this.bossTime});
};


MainBullyProtocol.prototype.getMainBully = function () {
    return this.MainBullyMap.get("Main");
};

MainBullyProtocol.prototype.checkIfMainBully = function (callback) {
    if (!this.lru.amBully()) {
        callback(false);
    } else {
        var lru = this.lru;
        var mbp = this;
        if (lru.FileID_MainBully) {
            if (this.MainBullyMap) {
                var current = this.getMainBully();
                if (current) {
                    console.log("Current main bully:" + JSON.stringify(current));
                    console.log("Current main bully time left:" + (current.end - ServerDate));
                    if (current.start <= ServerDate && ServerDate <= current.end) {
                        if (current.id == lru.id && (current.end - ServerDate) < mbp.renewTime) {
                            mbp.setSelfAsMainBully();
                        }
                        callback(current.id == mbp.id);
                    } else {
                        //console.log("Setting self as main bully.");
                        mbp.setSelfAsMainBully();
                        setTimeout(function () {
                            mbp.checkIfMainBully(callback)
                        }, 100);
                    }
                } else {
                    mbp.setSelfAsMainBully();
                    mbp.checkIfMainBully(callback);
                }
            } else {
                realtimeUtils.load(lru.FileID_MainBully.replace('/', ''),
                    function (doc) {
                        console.log("MBF load");
                        mbp.MainBullyMap = doc.getModel().getRoot().get('b2b_map');
                        mbp.checkIfMainBully(callback)
                        console.log("MBF load done");
                    }, function (model) {
                        console.log("MBF init");
                        var map = model.createMap({
                            FileID_Original: lru.FileID_Original
                        });
                        model.getRoot().set('b2b_map', map);
                        console.log("MBF init done");
                    });
            }
        } else {
            getPropertyFromFile(lru.FileID_Original, lru.constants.FileID_MainBully, function (property) {
                if (!property) {
                    lru.realtimeUtils.createRealtimeFile(lru.constants.FileID_MainBully, function (createResponse) {
                        addPropertyToFile(lru.FileID_Original, lru.constants.FileID_MainBully, createResponse.id, function () {
                            mbp.checkIfMainBully(callback);
                        });
                    });
                } else {
                    lru.FileID_MainBully = property;
                    mbp.checkIfMainBully(callback);
                }
            });
        }
    }
};

