if (typeof exports != "undefined")
    exports.DS_DLList = DS_DLList;

function DS_DLList() {
    this.head = null;
    this.tail = null;
    this.count = 0;
}

DS_DLList.prototype.size = function () {
    return this.count;
};

DS_DLList.prototype.isEmpty = function () {
    return this.size() == 0;
};

DS_DLList.prototype.addFirst = function (element) {
    var node = new DS_DLL_Node(element);
    if (this.isEmpty()) {
        this.head = this.tail = node;
    } else {
        node.next = this.head;
        if (this.head)
            this.head.previous = node;
        this.head = node;
    }
    this.count++;
};

DS_DLList.prototype.addLast = function (element) {
    var node = new DS_DLL_Node(element);
    if (this.isEmpty()) {
        this.head = node;
        this.tail = node;
    } else {
        node.previous = this.tail;
        if (this.tail)
            this.tail.next = node;
        this.tail = node;
    }
    this.count++;
};

DS_DLList.prototype.getFirst = function () {
    if (this.isEmpty()) {
        return undefined;
    } else {
        return this.head.element;
    }
};

DS_DLList.prototype.getLast = function () {
    if (this.isEmpty()) {
        return undefined;
    } else {
        return this.tail.element;
    }
};

DS_DLList.prototype.removeFirst = function () {
    if (this.isEmpty()) {
        return undefined;
    } else {
        var oldHead = this.head;
        this.head = oldHead.next;
        if (this.head instanceof  DS_DLL_Node) {
            this.head.previous = null;
        }
        var ret = oldHead.element;
        this.count--;
        return ret;
    }
};

DS_DLList.prototype.removeLast = function () {
    if (this.isEmpty()) {
        return undefined;
    } else {
        var oldTail = this.tail;
        this.tail = oldTail.previous;
        if (this.tail instanceof  DS_DLL_Node) {
            this.tail.next = null;
        }
        var ret = oldTail.element;
        this.count--;
        return ret;
    }
};

DS_DLList.prototype.clear = function () {
    this.count = 0;
    this.head = this.tail = null;
};

function DS_DLL_Node(element) {
    this.next = null;
    this.previous = null;
    this.element = element;
}