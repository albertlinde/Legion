function NodesStructure() {
    this.nodesMap = {};
    this.count = 0;
    this.keys = [];
}

NodesStructure.prototype.size = function () {
    return this.count;
};

NodesStructure.prototype.contains = function (id) {
    return this.nodesMap[id] != null;
};

NodesStructure.prototype.getNode = function (id) {
    return this.nodesMap[id];
};
NodesStructure.prototype.getNodeByPos = function (pos) {
    if (pos == 0) {
        this.keys = Object.keys(this.nodesMap);
    }
    return this.nodesMap[this.keys[pos]];
};

NodesStructure.prototype.addNode = function (id, socket) {
    if (!this.contains(id))
        this.count++;
    this.nodesMap[id] = socket;
};

NodesStructure.prototype.removeAllNodes = function (idArray) {
    for (var i = 0; i < idArray.length; i++) {
        this.removeNode(idArray[i]);
    }
};

NodesStructure.prototype.removeNode = function (id) {
    if (this.contains(id))
        this.count--;
    delete this.nodesMap[id];
};
exports.NodesStructure = NodesStructure;