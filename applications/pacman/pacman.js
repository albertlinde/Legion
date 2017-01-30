/*jslint browser: true, undef: true, eqeqeq: true, nomen: true, white: true */
/*global window: false, document: false */
var CLIENT_ID = '1073496658879-9lia1jb7a5fcm6t6j8k8jvjr26u5ujes.apps.googleusercontent.com';

var realtimeUtils = new utils.RealtimeUtils({clientId: CLIENT_ID});
var lru = new LegionRealtimeUtils(realtimeUtils);

function inviteToGame() {
    var game_id = realtimeUtils.getParam('gameid');
    var email = document.getElementById('email').value;
    request = gapi.client.request({
        path: '/drive/v2/files/' + game_id + '/permissions?sendNotificationEmails=false',
        method: 'POST',
        body: {
            role: 'writer',
            type: 'user',
            value: email
        }
    });
    request.execute(function (res) {
        console.log(res);
    })
};

var DIRECTIONS = {
    NONE: 4,
    UP: 3,
    LEFT: 2,
    DOWN: 1,
    RIGHT: 11
};

var Pacman = {};
Pacman.WALL = 0;
Pacman.BISCUIT = 1;
Pacman.EMPTY = 2;
Pacman.PILL = 4;
Pacman.FPS = 30;

Pacman.MAP = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 4, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 4, 0],
    [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
    [2, 2, 2, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 2, 2, 2],
    [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
    [2, 2, 2, 2, 1, 1, 1, 0, 2, 2, 2, 0, 1, 1, 1, 2, 2, 2, 2],
    [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
    [2, 2, 2, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 2, 2, 2],
    [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
    [0, 4, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 4, 0],
    [0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0],
    [0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

Pacman.WALLS = [

    [{
        "move": [0, 9.5]
    }, {
        "line": [3, 9.5]
    },
        {
            "curve": [3.5, 9.5, 3.5, 9]
        }, {
        "line": [3.5, 8]
    },
        {
            "curve": [3.5, 7.5, 3, 7.5]
        }, {
        "line": [1, 7.5]
    },
        {
            "curve": [0.5, 7.5, 0.5, 7]
        }, {
        "line": [0.5, 1]
    },
        {
            "curve": [0.5, 0.5, 1, 0.5]
        }, {
        "line": [9, 0.5]
    },
        {
            "curve": [9.5, 0.5, 9.5, 1]
        }, {
        "line": [9.5, 3.5]
    }],

    [{
        "move": [9.5, 1]
    },
        {
            "curve": [9.5, 0.5, 10, 0.5]
        }, {
        "line": [18, 0.5]
    },
        {
            "curve": [18.5, 0.5, 18.5, 1]
        }, {
        "line": [18.5, 7]
    },
        {
            "curve": [18.5, 7.5, 18, 7.5]
        }, {
        "line": [16, 7.5]
    },
        {
            "curve": [15.5, 7.5, 15.5, 8]
        }, {
        "line": [15.5, 9]
    },
        {
            "curve": [15.5, 9.5, 16, 9.5]
        }, {
        "line": [19, 9.5]
    }],

    [{
        "move": [2.5, 5.5]
    }, {
        "line": [3.5, 5.5]
    }],

    [{
        "move": [3, 2.5]
    },
        {
            "curve": [3.5, 2.5, 3.5, 3]
        },
        {
            "curve": [3.5, 3.5, 3, 3.5]
        },
        {
            "curve": [2.5, 3.5, 2.5, 3]
        },
        {
            "curve": [2.5, 2.5, 3, 2.5]
        }],

    [{
        "move": [15.5, 5.5]
    }, {
        "line": [16.5, 5.5]
    }],

    [{
        "move": [16, 2.5]
    }, {
        "curve": [16.5, 2.5, 16.5, 3]
    },
        {
            "curve": [16.5, 3.5, 16, 3.5]
        }, {
        "curve": [15.5, 3.5, 15.5, 3]
    },
        {
            "curve": [15.5, 2.5, 16, 2.5]
        }],

    [{
        "move": [6, 2.5]
    }, {
        "line": [7, 2.5]
    }, {
        "curve": [7.5, 2.5, 7.5, 3]
    },
        {
            "curve": [7.5, 3.5, 7, 3.5]
        }, {
        "line": [6, 3.5]
    },
        {
            "curve": [5.5, 3.5, 5.5, 3]
        }, {
        "curve": [5.5, 2.5, 6, 2.5]
    }],

    [{
        "move": [12, 2.5]
    }, {
        "line": [13, 2.5]
    }, {
        "curve": [13.5, 2.5, 13.5, 3]
    },
        {
            "curve": [13.5, 3.5, 13, 3.5]
        }, {
        "line": [12, 3.5]
    },
        {
            "curve": [11.5, 3.5, 11.5, 3]
        }, {
        "curve": [11.5, 2.5, 12, 2.5]
    }],

    [{
        "move": [7.5, 5.5]
    }, {
        "line": [9, 5.5]
    }, {
        "curve": [9.5, 5.5, 9.5, 6]
    },
        {
            "line": [9.5, 7.5]
        }],
    [{
        "move": [9.5, 6]
    }, {
        "curve": [9.5, 5.5, 10.5, 5.5]
    },
        {
            "line": [11.5, 5.5]
        }],


    [{
        "move": [5.5, 5.5]
    }, {
        "line": [5.5, 7]
    }, {
        "curve": [5.5, 7.5, 6, 7.5]
    },
        {
            "line": [7.5, 7.5]
        }],
    [{
        "move": [6, 7.5]
    }, {
        "curve": [5.5, 7.5, 5.5, 8]
    }, {
        "line": [5.5, 9.5]
    }],

    [{
        "move": [13.5, 5.5]
    }, {
        "line": [13.5, 7]
    },
        {
            "curve": [13.5, 7.5, 13, 7.5]
        }, {
        "line": [11.5, 7.5]
    }],
    [{
        "move": [13, 7.5]
    }, {
        "curve": [13.5, 7.5, 13.5, 8]
    },
        {
            "line": [13.5, 9.5]
        }],

    [{
        "move": [0, 11.5]
    }, {
        "line": [3, 11.5]
    }, {
        "curve": [3.5, 11.5, 3.5, 12]
    },
        {
            "line": [3.5, 13]
        }, {
        "curve": [3.5, 13.5, 3, 13.5]
    }, {
        "line": [1, 13.5]
    },
        {
            "curve": [0.5, 13.5, 0.5, 14]
        }, {
        "line": [0.5, 17]
    },
        {
            "curve": [0.5, 17.5, 1, 17.5]
        }, {
        "line": [1.5, 17.5]
    }],
    [{
        "move": [1, 17.5]
    }, {
        "curve": [0.5, 17.5, 0.5, 18]
    }, {
        "line": [0.5, 21]
    },
        {
            "curve": [0.5, 21.5, 1, 21.5]
        }, {
        "line": [18, 21.5]
    },
        {
            "curve": [18.5, 21.5, 18.5, 21]
        }, {
        "line": [18.5, 18]
    },
        {
            "curve": [18.5, 17.5, 18, 17.5]
        }, {
        "line": [17.5, 17.5]
    }],
    [{
        "move": [18, 17.5]
    }, {
        "curve": [18.5, 17.5, 18.5, 17]
    },
        {
            "line": [18.5, 14]
        }, {
        "curve": [18.5, 13.5, 18, 13.5]
    },
        {
            "line": [16, 13.5]
        }, {
        "curve": [15.5, 13.5, 15.5, 13]
    },
        {
            "line": [15.5, 12]
        }, {
        "curve": [15.5, 11.5, 16, 11.5]
    },
        {
            "line": [19, 11.5]
        }],

    [{
        "move": [5.5, 11.5]
    }, {
        "line": [5.5, 13.5]
    }],
    [{
        "move": [13.5, 11.5]
    }, {
        "line": [13.5, 13.5]
    }],

    [{
        "move": [2.5, 15.5]
    }, {
        "line": [3, 15.5]
    },
        {
            "curve": [3.5, 15.5, 3.5, 16]
        }, {
        "line": [3.5, 17.5]
    }],
    [{
        "move": [16.5, 15.5]
    }, {
        "line": [16, 15.5]
    },
        {
            "curve": [15.5, 15.5, 15.5, 16]
        }, {
        "line": [15.5, 17.5]
    }],

    [{
        "move": [5.5, 15.5]
    }, {
        "line": [7.5, 15.5]
    }],
    [{
        "move": [11.5, 15.5]
    }, {
        "line": [13.5, 15.5]
    }],

    [{
        "move": [2.5, 19.5]
    }, {
        "line": [5, 19.5]
    },
        {
            "curve": [5.5, 19.5, 5.5, 19]
        }, {
        "line": [5.5, 17.5]
    }],
    [{
        "move": [5.5, 19]
    }, {
        "curve": [5.5, 19.5, 6, 19.5]
    },
        {
            "line": [7.5, 19.5]
        }],

    [{
        "move": [11.5, 19.5]
    }, {
        "line": [13, 19.5]
    },
        {
            "curve": [13.5, 19.5, 13.5, 19]
        }, {
        "line": [13.5, 17.5]
    }],
    [{
        "move": [13.5, 19]
    }, {
        "curve": [13.5, 19.5, 14, 19.5]
    },
        {
            "line": [16.5, 19.5]
        }],

    [{
        "move": [7.5, 13.5]
    }, {
        "line": [9, 13.5]
    },
        {
            "curve": [9.5, 13.5, 9.5, 14]
        }, {
        "line": [9.5, 15.5]
    }],
    [{
        "move": [9.5, 14]
    }, {
        "curve": [9.5, 13.5, 10, 13.5]
    },
        {
            "line": [11.5, 13.5]
        }],

    [{
        "move": [7.5, 17.5]
    }, {
        "line": [9, 17.5]
    },
        {
            "curve": [9.5, 17.5, 9.5, 18]
        }, {
        "line": [9.5, 19.5]
    }],
    [{
        "move": [9.5, 18]
    }, {
        "curve": [9.5, 17.5, 10, 17.5]
    },
        {
            "line": [11.5, 17.5]
        }],

    [{
        "move": [8.5, 9.5]
    }, {
        "line": [8, 9.5]
    }, {
        "curve": [7.5, 9.5, 7.5, 10]
    },
        {
            "line": [7.5, 11]
        }, {
        "curve": [7.5, 11.5, 8, 11.5]
    },
        {
            "line": [11, 11.5]
        }, {
        "curve": [11.5, 11.5, 11.5, 11]
    },
        {
            "line": [11.5, 10]
        }, {
        "curve": [11.5, 9.5, 11, 9.5]
    },
        {
            "line": [10.5, 9.5]
        }]
];

var STATE = {
    WAITING: 0,
    COUNTDOWN: 1,
    PLAYING: 2,
    PAUSE: 3,
    DYING: 4,
    FINISHED: 5
};

var INITVALUES = {
    pacman: {
        position: {"x": 90, "y": 120},
        lives: 3,
        biscuitsEaten: 0,
        score: 0,
        direction: DIRECTIONS.LEFT,
        due: DIRECTIONS.LEFT
    },
    ghosts: {
        position: {"x": 90, "y": 80},
        direction: DIRECTIONS.LEFT,
        due: DIRECTIONS.LEFT,
        colours: ["#00FFDE", "#FF0000", "#FFB8DE", "#FFB847"]
    },
    map: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 4, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 4, 0],
        [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0],
        [0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
        [2, 2, 2, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 2, 2, 2],
        [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
        [2, 2, 2, 2, 1, 1, 1, 0, 2, 2, 2, 0, 1, 1, 1, 2, 2, 2, 2],
        [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
        [2, 2, 2, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 2, 2, 2],
        [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
        [0, 4, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 4, 0],
        [0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0],
        [0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]
};

var KEY = {
    'BACKSPACE': 8,
    'TAB': 9,
    'NUM_PAD_CLEAR': 12,
    'ENTER': 13,
    'SHIFT': 16,
    'CTRL': 17,
    'ALT': 18,
    'PAUSE': 19,
    'CAPS_LOCK': 20,
    'ESCAPE': 27,
    'SPACEBAR': 32,
    'PAGE_UP': 33,
    'PAGE_DOWN': 34,
    'END': 35,
    'HOME': 36,
    'ARROW_LEFT': 37,
    'ARROW_UP': 38,
    'ARROW_RIGHT': 39,
    'ARROW_DOWN': 40,
    'PRINT_SCREEN': 44,
    'INSERT': 45,
    'DELETE': 46,
    'SEMICOLON': 59,
    'WINDOWS_LEFT': 91,
    'WINDOWS_RIGHT': 92,
    'SELECT': 93,
    'NUM_PAD_ASTERISK': 106,
    'NUM_PAD_PLUS_SIGN': 107,
    'NUM_PAD_HYPHEN-MINUS': 109,
    'NUM_PAD_FULL_STOP': 110,
    'NUM_PAD_SOLIDUS': 111,
    'NUM_LOCK': 144,
    'SCROLL_LOCK': 145,
    'SEMICOLON2': 186,
    'EQUALS_SIGN': 187,
    'COMMA': 188,
    'HYPHEN-MINUS': 189,
    'FULL_STOP': 190,
    'SOLIDUS': 191,
    'GRAVE_ACCENT': 192,
    'LEFT_SQUARE_BRACKET': 219,
    'REVERSE_SOLIDUS': 220,
    'RIGHT_SQUARE_BRACKET': 221,
    'APOSTROPHE': 222
};

(function () {
    /* 0 - 9 */
    for (var i = 48; i <= 57; i++) {
        KEY['' + (i - 48)] = i;
    }
    /* A - Z */
    for (i = 65; i <= 90; i++) {
        KEY['' + String.fromCharCode(i)] = i;
    }
    /* NUM_PAD_0 - NUM_PAD_9 */
    for (i = 96; i <= 105; i++) {
        KEY['NUM_PAD_' + (i - 96)] = i;
    }
    /* F1 - F12 */
    for (i = 112; i <= 123; i++) {
        KEY['F' + (i - 112 + 1)] = i;
    }
})();

var keyMap = {};
keyMap[KEY.ARROW_LEFT] = DIRECTIONS.LEFT;
keyMap[KEY.ARROW_UP] = DIRECTIONS.UP;
keyMap[KEY.ARROW_RIGHT] = DIRECTIONS.RIGHT;
keyMap[KEY.ARROW_DOWN] = DIRECTIONS.DOWN;

function Ghost(id, game, map, colour, position, direction, eatable, eaten, due) {

    this.id = id;
    this.game = game;
    this.map = map;
    this.colour = colour;
    this.position = position;
    this.direction = direction;
    this.eatable = eatable;
    this.eatableStartTick = 0;
    this.eaten = eaten;
    this.eatenStartTick = 0;
    this.due = due;

    this.getNewCoord = function (dir, current) {

        var speed = this.eatable ? 1 : this.eaten ? 4 : 2,
            xSpeed = (dir === DIRECTIONS.LEFT && -speed || dir === DIRECTIONS.RIGHT && speed || 0),
            ySpeed = (dir === DIRECTIONS.DOWN && speed || dir === DIRECTIONS.UP && -speed || 0);

        return {
            "x": this.addBounded(current.x, xSpeed),
            "y": this.addBounded(current.y, ySpeed)
        };
    };

    /* Collision detection(walls) is done when a ghost lands on an
     * exact block, make sure they dont skip over it
     */
    this.addBounded = function (x1, x2) {
        var rem = x1 % 10,
            result = rem + x2;
        if (rem !== 0 && result > 10) {
            return x1 + (10 - rem);
        } else if (rem > 0 && result < 0) {
            return x1 - rem;
        }
        return x1 + x2;
    };

    this.isDangerous = function () {
        return this.eaten == false && this.eatable == false;
    };

    this.getRandomDirection = function () {
        var moves = (this.direction === DIRECTIONS.LEFT || this.direction === DIRECTIONS.RIGHT) ? [DIRECTIONS.UP, DIRECTIONS.DOWN] : [DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
        return moves[Math.floor(Math.random() * 2)];
    };
    /*
     this.getRandomDirectionIncludingFront = function() {
     var moves = (this.direction === DIRECTIONS.LEFT || this.direction === DIRECTIONS.RIGHT) ? [DIRECTIONS.UP, DIRECTIONS.DOWN, this.direction] : [DIRECTIONS.LEFT, DIRECTIONS.RIGHT, this.direction];
     return moves[Math.floor(Math.random() * 3)];
     };*/

    this.onWholeSquare = function (x) {
        return x % 10 === 0;
    };
    /*
     this.oppositeDirection = function(dir) {
     return dir === DIRECTIONS.LEFT && DIRECTIONS.RIGHT ||
     dir === DIRECTIONS.RIGHT && DIRECTIONS.LEFT ||
     dir === DIRECTIONS.UP && DIRECTIONS.DOWN || DIRECTIONS.UP;
     };
     */
    this.pointToCoord = function (x) {
        return Math.round(x / 10);
    };

    this.nextSquare = function (x, dir) {
        var rem = x % 10;
        if (rem === 0) {
            return x;
        } else if (dir === DIRECTIONS.RIGHT || dir === DIRECTIONS.DOWN) {
            return x + (10 - rem);
        } else {
            return x - rem;
        }
    };

    this.onGridSquare = function (pos) {
        return this.onWholeSquare(pos.y) && this.onWholeSquare(pos.x);
    };

    this.getColour = function () {
        if (this.eatable) {
            if (this.game.secondsAgo(this.eatableStartTick) > 5) {
                return game.getTick() % 20 > 10 ? "#FFFFFF" : "#0000BB";
            } else {
                return "#0000BB";
            }
        } else if (this.eaten) {
            return "#222";
        }
        return this.colour;
    };

    this.draw = function (ctx) {

        var s = map.blockSize,
            top = (this.position.y / 10) * s,
            left = (this.position.x / 10) * s;

        var tl = left + s;
        var base = top + s - 3;
        var inc = s / 10;

        var high = game.getTick() % 10 > 5 ? 3 : -3;
        var low = game.getTick() % 10 > 5 ? -3 : 3;

        ctx.fillStyle = this.getColour();
        ctx.beginPath();

        ctx.moveTo(left, base);

        ctx.quadraticCurveTo(left, top, left + (s / 2), top);
        ctx.quadraticCurveTo(left + s, top, left + s, base);

        // Wavy things at the bottom
        ctx.quadraticCurveTo(tl - (inc), base + high, tl - (inc * 2), base);
        ctx.quadraticCurveTo(tl - (inc * 3), base + low, tl - (inc * 4), base);
        ctx.quadraticCurveTo(tl - (inc * 5), base + high, tl - (inc * 6), base);
        ctx.quadraticCurveTo(tl - (inc * 7), base + low, tl - (inc * 8), base);
        ctx.quadraticCurveTo(tl - (inc * 9), base + high, tl - (inc * 10), base);

        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = "#FFF";
        ctx.arc(left + 6, top + 6, s / 6, 0, 300, false);
        ctx.arc((left + s) - 6, top + 6, s / 6, 0, 300, false);
        ctx.closePath();
        ctx.fill();

        var f = s / 12;
        var off = {};
        off[DIRECTIONS.RIGHT] = [f, 0];
        off[DIRECTIONS.LEFT] = [-f, 0];
        off[DIRECTIONS.UP] = [0, -f];
        off[DIRECTIONS.DOWN] = [0, f];

        ctx.beginPath();
        ctx.fillStyle = "#000";
        ctx.arc(left + 6 + off[this.direction][0], top + 6 + off[this.direction][1],
            s / 15, 0, 300, false);
        ctx.arc((left + s) - 6 + off[this.direction][0], top + 6 + off[this.direction][1],
            s / 15, 0, 300, false);
        ctx.closePath();
        ctx.fill();

    };

    this.pane = function (pos) {

        if (pos.y === 100 && pos.x >= 190 && this.direction === DIRECTIONS.RIGHT) {
            return {
                "y": 100,
                "x": -10
            };
        }

        if (pos.y === 100 && pos.x <= -10 && this.direction === DIRECTIONS.LEFT) {
            return {
                "y": 100,
                "x": 190
            };
        }

        return false;
    };

    this.move = function () {

        var oldPos = this.position,
            onGrid = this.onGridSquare(this.position),
            npos = null,
            sendPos = false,
            sendDue = false;

        if (this.due !== this.direction) {

            npos = this.getNewCoord(this.due, this.position);

            if (onGrid &&
                map.isFloorSpace({
                    "y": this.pointToCoord(this.nextSquare(npos.y, this.due)),
                    "x": this.pointToCoord(this.nextSquare(npos.x, this.due))
                })) {
                this.direction = this.due;
                sendPos = true;
            } else {
                npos = null;
            }
        }

        if (npos === null) {
            npos = this.getNewCoord(this.direction, this.position);
        }

        if (onGrid &&
            map.isWallSpace({
                "y": this.pointToCoord(this.nextSquare(npos.y, this.direction)),
                "x": this.pointToCoord(this.nextSquare(npos.x, this.direction))
            })) {
            npos = oldPos;
        }

        this.position = npos;

        var tmp = this.pane(this.position);
        if (tmp) {
            this.position = tmp;
        }

        if (this.game.isPacman() && !this.game.isPlayerControlled(this.id) && onGrid) {
            this.due = this.getRandomDirection();
            sendDue = true;
        }
        return {
            "new": this.position,
            "old": oldPos,
            "sendPos": sendPos,
            "sendDue": sendDue
        };
    };
}

function Pac(map, position, lives, score, direction, due, biscuitsEaten) {

    this.map = map;
    this.position = position;
    this.lives = lives;
    this.biscuitsEaten = biscuitsEaten;
    this.score = score;
    this.direction = direction;
    this.due = due;

    this.getNewCoord = function (dir, current) {
        return {
            "x": current.x + (dir === DIRECTIONS.LEFT && -2 || dir === DIRECTIONS.RIGHT && 2 || 0),
            "y": current.y + (dir === DIRECTIONS.DOWN && 2 || dir === DIRECTIONS.UP && -2 || 0)
        };
    };

    this.onWholeSquare = function (x) {
        return x % 10 === 0;
    };

    this.pointToCoord = function (x) {
        return Math.round(x / 10);
    };

    this.nextSquare = function (x, dir) {
        var rem = x % 10;
        if (rem === 0) {
            return x;
        } else if (dir === DIRECTIONS.RIGHT || dir === DIRECTIONS.DOWN) {
            return x + (10 - rem);
        } else {
            return x - rem;
        }
    };

    this.next = function (pos, dir) {
        return {
            "y": this.pointToCoord(this.nextSquare(pos.y, dir)),
            "x": this.pointToCoord(this.nextSquare(pos.x, dir))
        };
    };

    this.onGridSquare = function (pos) {
        return this.onWholeSquare(pos.y) && this.onWholeSquare(pos.x);
    };

    this.isOnSamePlane = function (due, dir) {
        return ((due === DIRECTIONS.LEFT || due === DIRECTIONS.RIGHT) &&
            (dir === DIRECTIONS.LEFT || dir === DIRECTIONS.RIGHT)) ||
            ((due === DIRECTIONS.UP || due === DIRECTIONS.DOWN) &&
            (dir === DIRECTIONS.UP || dir === DIRECTIONS.DOWN));
    };

    this.move = function () {

        var npos = null,
            nextWhole,
            oldPosition = this.position,
            sendPos = false;

        //check if can turn
        if (this.due !== this.direction) {
            npos = this.getNewCoord(this.due, this.position);

            if (this.isOnSamePlane(this.due, this.direction) ||
                (this.onGridSquare(this.position) && map.isFloorSpace(this.next(npos, this.due)))) {
                this.direction = this.due;
                sendPos = true;
            } else {
                npos = null;
            }
        }

        //didnt turn, keep going front
        if (npos === null) {
            npos = this.getNewCoord(this.direction, this.position);
        }

        //end of road, stop
        if (this.onGridSquare(this.position) && map.isWallSpace(this.next(npos, this.direction))) {
            this.direction = DIRECTIONS.NONE; //STOPPED
        }


        //stopped, return
        if (this.direction === DIRECTIONS.NONE) {
            return {
                "new": this.position,
                "old": this.position,
                "nextWhole": null,
                "sendPos": sendPos
            };
        }

        //check "portals"
        if (npos.y === 100 && npos.x >= 190 && this.direction === DIRECTIONS.RIGHT) {
            npos = {
                "y": 100,
                "x": -10
            };
        }

        if (npos.y === 100 && npos.x <= -12 && this.direction === DIRECTIONS.LEFT) {
            npos = {
                "y": 100,
                "x": 190
            };
        }


        this.position = npos;
        nextWhole = this.next(this.position, this.direction);
        return {
            "new": this.position,
            "old": oldPosition,
            "nextWhole": nextWhole,
            "sendPos": sendPos
        };
    };

    this.isMidSquare = function (x) {
        var rem = x % 10;
        return rem > 3 || rem < 7;
    };

    this.calcAngle = function (dir, pos) {
        if (dir == DIRECTIONS.RIGHT && (pos.x % 10 < 5)) {
            return {
                "start": 0.25,
                "end": 1.75,
                "direction": false
            };
        } else if (dir === DIRECTIONS.DOWN && (pos.y % 10 < 5)) {
            return {
                "start": 0.75,
                "end": 2.25,
                "direction": false
            };
        } else if (dir === DIRECTIONS.UP && (pos.y % 10 < 5)) {
            return {
                "start": 1.25,
                "end": 1.75,
                "direction": true
            };
        } else if (dir === DIRECTIONS.LEFT && (pos.x % 10 < 5)) {
            return {
                "start": 0.75,
                "end": 1.25,
                "direction": true
            };
        }
        return {
            "start": 0,
            "end": 2,
            "direction": false
        };
    };

    this.drawDead = function (ctx, amount) {

        var size = map.blockSize,
            half = size / 2;

        if (amount >= 1) {
            return;
        }

        ctx.fillStyle = "#FFFF00";
        ctx.beginPath();
        ctx.moveTo(((this.position.x / 10) * size) + half, ((this.position.y / 10) * size) + half);

        ctx.arc(((this.position.x / 10) * size) + half, ((this.position.y / 10) * size) + half,
            half, 0, Math.PI * 2 * amount, true);

        ctx.fill();
    };

    this.draw = function (ctx) {

        var s = map.blockSize,
            angle = this.calcAngle(this.direction, this.position);

        ctx.fillStyle = "#FFFF00";

        ctx.beginPath();

        ctx.moveTo(((this.position.x / 10) * s) + s / 2, ((this.position.y / 10) * s) + s / 2);

        ctx.arc(((this.position.x / 10) * s) + s / 2, ((this.position.y / 10) * s) + s / 2,
            s / 2, Math.PI * angle.start,
            Math.PI * angle.end, angle.direction);

        ctx.fill();
    };
}

function Map(sharedList, mapHeight, mapWidth, mapBlockSize) {
    this.list = sharedList;
    this.blockSize = mapBlockSize;
    this.height = mapHeight;
    this.width = mapWidth;
    this.pillSize = 0;

    this.withinBounds = function (y, x) {
        return y >= 0 && y < this.height && x >= 0 && x < this.width;
    };

    this.isWallSpace = function (pos) {
        return this.withinBounds(pos.y, pos.x) && this.blockByPos(pos) === Pacman.WALL;
    };

    this.isFloorSpace = function (pos) {
        if (!this.withinBounds(pos.y, pos.x)) {
            return false;
        }
        var piece = this.blockByPos(pos);
        return piece === Pacman.EMPTY ||
            piece === Pacman.BISCUIT ||
            piece === Pacman.PILL;
    };

    this.blockByPos = function (pos) {
        return this.blockByCoords(pos.y, pos.x);
    };

    this.blockByCoords = function (y, x) {
        return this.list.get(this.width * y + x);
    };

    this.setBlock = function (pos, type) {
        this.list.set(this.width * pos.y + pos.x, type);
    };

    this.draw = function (ctx) {
        var size = this.blockSize;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, this.width * size, this.height * size);
        this.drawWalls(ctx);
        this.drawBlocks(ctx);
    };

    this.drawBlocks = function (ctx) {
        for (var y = 0; y < this.height; y += 1) {
            for (var x = 0; x < this.width; x += 1) {
                var layout = this.blockByCoords(y, x);

                ctx.beginPath();

                if (layout === Pacman.EMPTY || layout === Pacman.BISCUIT || layout === Pacman.PILL) {
                    ctx.fillStyle = "#000";
                    ctx.fillRect((x * this.blockSize), (y * this.blockSize), this.blockSize, this.blockSize);
                    if (layout === Pacman.BISCUIT) {
                        ctx.fillStyle = "#FFF";
                        ctx.fillRect((x * this.blockSize) + (this.blockSize / 2.5), (y * this.blockSize) + (this.blockSize / 2.5),
                            this.blockSize / 6, this.blockSize / 6);
                    } else if (layout === Pacman.PILL) {

                        ctx.fillStyle = "#000";
                        ctx.fillRect((x * this.blockSize), (y * this.blockSize),
                            this.blockSize, this.blockSize);

                        ctx.fillStyle = "#FFF";
                        ctx.arc((x * this.blockSize) + this.blockSize / 2, (y * this.blockSize) + this.blockSize / 2,
                            Math.abs(5 - (this.pillSize / 3)),
                            0,
                            Math.PI * 2, false);
                        ctx.fill();
                    }
                }
                ctx.closePath();
            }
        }
    };

    this.drawWalls = function (ctx) {

        var i, j, p, line;

        ctx.strokeStyle = "#0000FF";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";

        for (i = 0; i < Pacman.WALLS.length; i += 1) {
            line = Pacman.WALLS[i];
            ctx.beginPath();

            for (j = 0; j < line.length; j += 1) {

                p = line[j];

                if (p.move) {
                    ctx.moveTo(p.move[0] * this.blockSize, p.move[1] * this.blockSize);
                } else if (p.line) {
                    ctx.lineTo(p.line[0] * this.blockSize, p.line[1] * this.blockSize);
                } else if (p.curve) {
                    ctx.quadraticCurveTo(p.curve[0] * this.blockSize,
                        p.curve[1] * this.blockSize,
                        p.curve[2] * this.blockSize,
                        p.curve[3] * this.blockSize);
                }
            }
            ctx.stroke();
        }
    }
}

function Game() {

    var myId = guid(),
        localPacman, sharedPacmanMap,
        localGhosts = [], sharedGhostsMap = [],
        playersMap,
        gamestateMap,
        eventsList,
        map,
        controlling = null,
        wrapper,
        tick = 0,
        timerStart = null,
        ctx = null,
        timer = null,
        biscuitLog = [],
        timestampLog = [],
        movementLog = [];

    function guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

    //SHARED

    function isPacman() {
        return controlling == 'pacman';
    }

    function isPlayerControlled(id) {
        return playersMap.has('ghost' + id);
    }

    function getTick() {
        return tick;
    }

    function secondsAgo(starttick) {
        return (getTick() - starttick) / Pacman.FPS;
    }

    function setState(nState) {
        gamestateMap.set('state', nState);
    }

    function getState() {
        return gamestateMap.get('state');
    }

    function update() {
        if (getState() !== STATE.PAUSE) {
            tick++;
        }
        switch (getState()) {
            case STATE.PLAYING:
                var ghostPos = [];
                for (i = 0; i < localGhosts.length; i += 1) {
                    ghostPos.push(localGhosts[i].move());
                }
                var moveRet = localPacman.move();

                if (isPacman()) { //Pacman only update
                    if (moveRet["sendPos"]) {
                        sharedPacmanMap.set('direction', localPacman.direction);
                        sharedPacmanMap.set('position', localPacman.position);
                    }
                    //Check pills/bisbuits
                    var pacPos = moveRet["new"];
                    if (moveRet["nextWhole"]) {
                        var nextWhole = moveRet["nextWhole"];
                        var block = map.blockByPos(nextWhole);
                        if ((localPacman.isMidSquare(pacPos.y) || localPacman.isMidSquare(pacPos.x)) &&
                            block === Pacman.BISCUIT || block === Pacman.PILL) {
                            //remove block
                            map.setBlock(nextWhole, Pacman.EMPTY);
                            //set score
                            sharedPacmanMap.set('score', localPacman.score + ((block === Pacman.BISCUIT) ? 10 : 50));
                            localPacman.biscuitsEaten += 1;
                            sharedPacmanMap.set('biscuitsEaten', localPacman.biscuitsEaten);
                            if (localPacman.biscuitsEaten === 182) {
                                setState(STATE.FINISHED);
                            }
                            if (block === Pacman.PILL) {
                                for (var j = 0; j < localGhosts.length; j += 1) {
                                    sharedGhostsMap[j].set('eatable', true);
                                }
                            }
                        }
                    }

                    //update ghosts
                    for (var i = 0; i < localGhosts.length; i += 1) {
                        var eatable = localGhosts[i].eatable;
                        var eaten = localGhosts[i].eaten;
                        var eatableStartTick = localGhosts[i].eatableStartTick;
                        var eatenStartTick = localGhosts[i].eatenStartTick;
                        if (eatable && secondsAgo(eatableStartTick) > 8) {
                            sharedGhostsMap[i].set('eatable', false);
                        }
                        if (eaten && secondsAgo(eatenStartTick) > 3) {
                            sharedGhostsMap[i].set('eaten', false);
                        }
                        if (ghostPos[i]["sendPos"]) {
                            sharedGhostsMap[i].set('direction', localGhosts[i].direction);
                            sharedGhostsMap[i].set('position', localGhosts[i].position);
                        }
                        if (ghostPos[i]["sendDue"]) {
                            sharedGhostsMap[i].set('due', localGhosts[i].due);
                        }

                        //Check collisions
                        if (collided(pacPos, ghostPos[i]["new"])) {
                            if (localGhosts[i].eatable) {
                                sharedGhostsMap[i].set('eatable', false);
                                sharedGhostsMap[i].set('eaten', true);
                                sharedPacmanMap.set('score', localPacman.score + 50);
                            } else if (localGhosts[i].isDangerous()) {
                                setState(STATE.DYING);
                                timerStart = tick;
                            }
                        }
                    }

                }
                break;
            case STATE.DYING:
                if (isPacman()) {
                    if (secondsAgo(timerStart) > 2) {
                        loseLife();
                    }
                }
                break;
            case STATE.COUNTDOWN:
                if (isPacman()) {
                    if (secondsAgo(timerStart) > 5) {
                        setState(STATE.PLAYING);
                    }
                }
                break;
        }
    }

    function mainLoop() {
        update();
        draw();
    }

    function restartPositions() {
        sharedPacmanMap.set('position', INITVALUES.pacman.position);
        sharedPacmanMap.set('direction', INITVALUES.pacman.direction);
        sharedPacmanMap.set('due', INITVALUES.pacman.due);
        for (var i = 0; i < localGhosts.length; i++) {
            sharedGhostsMap[i].set('position', INITVALUES.ghosts.position);
            sharedGhostsMap[i].set('direction', INITVALUES.ghosts.direction);
            sharedGhostsMap[i].set('due', INITVALUES.ghosts.due);
        }
    }

    function collided(pac, ghost) {
        return (Math.sqrt(Math.pow(ghost.x - pac.x, 2) +
                Math.pow(ghost.y - pac.y, 2))) < 10;
    }

    function pause() {
        if (getState() == STATE.PAUSE)
            return;
        gamestateMap.set('prevstate', getState());
        setState(STATE.PAUSE);
    }

    function resume() {
        if (getState() != STATE.PAUSE)
            return;
        setState(gamestateMap.get('prevstate'));
    }

    function loseLife() {
        localPacman.lives -= 1;
        sharedPacmanMap.set('lives', localPacman.lives);
        if (localPacman.lives <= 0) {
            setState(STATE.FINISHED);
        } else {
            restartPositions();
            setState(STATE.COUNTDOWN);
        }
    }

    function init(gameWrapper) {
        wrapper = gameWrapper;
        lru.load("game_haha", OnGameFileLoaded, OnGameFileInitialized);
        return;
        realtimeUtils.authorize(function (response) {
            if (response.error) {
                alert("Authorization error.");
            } else {
                var id = realtimeUtils.getParam('gameid');
                if (id) {

                } else {
                    alert("No game in url");
                }
            }
        }, false);
    }

    function OnGameFileInitialized(model) {
        console.log("First player, initializing model + setting initial values");

        var eventsList = model.createList();
        var playersMap = model.createMap();
        var gamestateMap = model.createMap({
            state: STATE.WAITING,
            prevstate: STATE.WAITING
        });
        var gameMapInfoMap = model.createMap({
            height: INITVALUES.map.length,
            width: INITVALUES.map[0].length
        });
        var gameMapList = model.createList();
        console.log(gameMapList);
        for (var i = 0; i < INITVALUES.map.length; i++) {
            gameMapList.pushAll(INITVALUES.map[i]);
        }

        var pacmanStateMap = model.createMap({
            position: INITVALUES.pacman.position,
            lives: INITVALUES.pacman.lives,
            score: INITVALUES.pacman.score,
            direction: INITVALUES.pacman.direction,
            due: INITVALUES.pacman.due,
            biscuitsEaten: INITVALUES.pacman.biscuitsEaten
        });
        for (i = 0; i < 4; i++) {
            var ghostStateMap = model.createMap({
                colour: INITVALUES.ghosts.colours[i],
                position: INITVALUES.ghosts.position,
                direction: INITVALUES.ghosts.direction,
                due: INITVALUES.ghosts.due,
                eatable: false,
                eaten: false
            });
            var compName = 'ghostState' + i;
            model.getRoot().set(compName, ghostStateMap);
        }
        model.getRoot().set('gameMap', gameMapList);
        model.getRoot().set('gameMapInfo', gameMapInfoMap);
        model.getRoot().set('pacmanState', pacmanStateMap);
        model.getRoot().set('events', eventsList);
        model.getRoot().set('players', playersMap);
        model.getRoot().set('gamestate', gamestateMap);

        console.log("Model initialized");
    }

    function OnGameFileLoaded(doc) {
        if (!gapi.drive) {
            gapi.drive = {
                realtime: {
                    EventType: {
                        VALUE_CHANGED: "1",
                        VALUES_SET: "2"
                    }
                }
            }
        }

        console.log("Game file loaded");

        //Load model
        playersMap = doc.getModel().getRoot().get('players');
        gamestateMap = doc.getModel().getRoot().get('gamestate');
        var gameMapList = doc.getModel().getRoot().get('gameMap');
        var gameMapInfoMap = doc.getModel().getRoot().get('gameMapInfo');
        eventsList = doc.getModel().getRoot().get('events');
        sharedPacmanMap = doc.getModel().getRoot().get('pacmanState');
        for (var i = 0; i < 4; i++) {
            var compName = 'ghostState' + i;
            sharedGhostsMap[i] = doc.getModel().getRoot().get(compName);
        }

        //Setup timestamp loggings
        playersMap.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function (event) {
            logTimestamp(event, "playersMap")
        });
        gamestateMap.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function (event) {
            logTimestamp(event, "gamestateMap")
        });
        gameMapList.addEventListener(gapi.drive.realtime.EventType.VALUES_SET, function (event) {
            logTimestamp(event, "gameMapList")
        });
        gameMapInfoMap.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function (event) {
            logTimestamp(event, "gameMapInfoMap")
        });
        eventsList.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function (event) {
            logTimestamp(event, "eventsList")
        });
        sharedPacmanMap.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function (event) {
            logTimestamp(event, "sharedPacmanMap")
        });
        sharedGhostsMap[0].addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function (event) {
            logTimestamp(event, "sharedGhostsMap0")
        });
        sharedGhostsMap[1].addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function (event) {
            logTimestamp(event, "sharedGhostsMap1")
        });
        sharedGhostsMap[2].addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function (event) {
            logTimestamp(event, "sharedGhostsMap2")
        });
        sharedGhostsMap[3].addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function (event) {
            logTimestamp(event, "sharedGhostsMap3")
        });
        //Setup biscuit loggings
        gameMapList.addEventListener(gapi.drive.realtime.EventType.VALUES_SET, logBiscuitDesync);


        gamestateMap.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, gameStateChanged);
        playersMap.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, playersMapChanged);

        //Setup local vars + wire
        var blockSize = wrapper.offsetWidth / gameMapInfoMap.get('width');
        map = new Map(gameMapList, gameMapInfoMap.get('height'), gameMapInfoMap.get('width'), blockSize);

        localPacman = new Pac(map,
            sharedPacmanMap.get('position'), sharedPacmanMap.get('lives'),
            sharedPacmanMap.get('score'), sharedPacmanMap.get('direction'),
            sharedPacmanMap.get('due'), sharedPacmanMap.get('biscuitsEaten')
        );
        sharedPacmanMap.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, updatePacman);

        for (var z = 0; z < 4; z++) {
            localGhosts[z] = new Ghost(z,
                {
                    "isPacman": isPacman,
                    "getTick": getTick,
                    "isPlayerControlled": isPlayerControlled,
                    "secondsAgo": secondsAgo
                },
                map,
                sharedGhostsMap[z].get('colour'), sharedGhostsMap[z].get('position'),
                sharedGhostsMap[z].get('direction'), sharedGhostsMap[z].get('eatable'),
                sharedGhostsMap[z].get('eaten'), sharedGhostsMap[z].get('due')
            );
        }
        sharedGhostsMap[0].addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, updateGhost0);
        sharedGhostsMap[1].addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, updateGhost1);
        sharedGhostsMap[2].addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, updateGhost2);
        sharedGhostsMap[3].addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, updateGhost3);

        //Join players list
        chooseRole();

        //Setup graphics
        var canvas = document.createElement("canvas");
        canvas.setAttribute("width", (blockSize * map.width) + "px");
        canvas.setAttribute("height", (blockSize * map.height) + 30 + "px");
        wrapper.appendChild(canvas);
        ctx = canvas.getContext('2d');

        //Start
        document.addEventListener("keydown", keyDown, true);
        document.addEventListener("keypress", keyPress, true);

        console.log('setup completed, starting');
        timer = window.setInterval(mainLoop, 1000 / Pacman.FPS);
    }

    function playersMapChanged(event) {
        console.log("playersMapChanged");
        if (event.property == controlling) {
            if (event.newValue != myId) {
                console.log("Someone stole " + event.property + " from us!");
                chooseRole();
            }
        }
    }

    function chooseRole() {
        controlling = null;
        if (!playersMap.has('pacman')) {
            playersMap.set('pacman', myId);
            controlling = 'pacman';
            console.log("Setting role to pacman");
        }
        if (controlling == null) {
            for (i = 0; i < 4; i++) {
                if (!playersMap.has('ghost' + i)) {
                    playersMap.set('ghost' + i, myId);
                    console.log("Setting role to ghost" + i);
                    controlling = 'ghost' + i;
                    document.getElementById("controlling").style.color = INITVALUES.ghosts.colours[i];
                    break;
                }
            }
        }
        if (controlling == null) {
            console.log('Setting role to spectator');
            document.getElementById("controlling").innerHTML = "Spectating";
            controlling = 'spectator';
        }
        document.getElementById("controlling").innerHTML = "Playing as: " + controlling;

    }

    function logBiscuitDesync(event) {
        //console.log(event);
        var index = event.index;
        var gridY = Math.floor(index / map.width);
        var gridX = index % map.width;
        var coordY = gridY * 10;
        var coordX = gridX * 10;
        diff = {}
        diff.offsetX = localPacman.position.x - coordX;
        diff.offsetY = localPacman.position.y - coordY;
        diff.direction = localPacman.direction;
        diff.desyncType = "none";
        if (diff.offsetX > 0) { //Direita
            if (localPacman.direction == DIRECTIONS.LEFT) {
                diff.desyncType = "behind";
            } else if (localPacman.direction == DIRECTIONS.RIGHT) {
                diff.desyncType = "ahead";
            }
        } else if (diff.offsetX < 0) { //Esquerda
            if (localPacman.direction == DIRECTIONS.LEFT) {
                diff.desyncType = "ahead";
            } else if (localPacman.direction == DIRECTIONS.RIGHT) {
                diff.desyncType = "behind"
            }
        }

        if (diff.offsetY < 0) { //Cima
            if (localPacman.direction == DIRECTIONS.UP) {
                diff.desyncType = "ahead";
            } else if (localPacman.direction == DIRECTIONS.DOWN) {
                diff.desyncType = "behind";
            }
        } else if (diff.offsetY > 0) { //Baixo
            if (localPacman.direction == DIRECTIONS.UP) {
                diff.desyncType = "behind";
            } else if (localPacman.direction == DIRECTIONS.DOWN) {
                diff.desyncType = "ahead";
            }
        }
        diff.timestamp = Date.now();
        biscuitLog.push(diff);
    }

    function logTimestamp(event, eventObject) {
        var obj = {}
        obj.timestamp = Date.now();
        obj.eventObject = eventObject;
        if (event.type == "value_changed") {
            obj.type = event.type;
            obj.property = event.property;
            obj.newValue = event.newValue;
            obj.oldValue = event.oldValue;
        } else if (event.type == "values_set") {
            obj.type = event.type;
            obj.index = event.index;
        }
        timestampLog.push(obj);
    }

    function logMovementDesync(diff) {
        diff.timestamp = Date.now();
        movementLog.push(diff);

    }

    function saveLogs() {
        saveTextAsFile("movementLog-" + controlling + "-" + Date.now() + ".log", JSON.stringify(movementLog));
        saveTextAsFile("biscuitLog-" + controlling + "-" + Date.now() + ".log", JSON.stringify(biscuitLog));
        saveTextAsFile("timestampLog-" + controlling + "-" + Date.now() + ".log", JSON.stringify(timestampLog));

    }

    function updateGhost0(event) {
        updateGhost(0, event);
    }

    function updateGhost1(event) {
        updateGhost(1, event);
    }

    function updateGhost2(event) {
        updateGhost(2, event);
    }

    function updateGhost3(event) {
        updateGhost(3, event);
    }

    function updateGhost(id, event) {
        if (event.property == 'colour') {
            localGhosts[id].colour = sharedGhostsMap[id].get('colour');
        } else if (event.property == 'position') {
            if (getState() == STATE.PLAYING) {
                var diff = {};
                diff.entity = "ghost" + id;
                diff.offsetX = localGhosts[id].position.x - sharedGhostsMap[id].get('position').x;
                diff.offsetY = localGhosts[id].position.y - sharedGhostsMap[id].get('position').y;
                diff.offsetTotal = Math.abs(diff.offsetX) + Math.abs(diff.offsetY);
                logMovementDesync(diff);
            }
            localGhosts[id].position = sharedGhostsMap[id].get('position');
        } else if (event.property == 'direction') {
            localGhosts[id].direction = sharedGhostsMap[id].get('direction');
        } else if (event.property == 'eatable') {
            localGhosts[id].eatable = sharedGhostsMap[id].get('eatable');
            if (localGhosts[id].eatable == true) {
                localGhosts[id].eatableStartTick = getTick();
            }
        } else if (event.property == 'eaten') {
            localGhosts[id].eaten = sharedGhostsMap[id].get('eaten');
            if (localGhosts[id].eaten == true) {
                localGhosts[id].eatenStartTick = getTick();
            }
        } else if (event.property == 'due') {
            localGhosts[id].due = sharedGhostsMap[id].get('due');
        }
    }

    function updatePacman(event) {
        console.log(sharedPacmanMap);
        console.log(event);
        console.log(event.property);
        if (event.property == 'position') {
            if (getState() == STATE.PLAYING) {
                var diff = {};
                diff.entity = "pacman";
                diff.offsetX = localPacman.position.x - sharedPacmanMap.get('position').x;
                diff.offsetY = localPacman.position.y - sharedPacmanMap.get('position').y;
                diff.offsetTotal = Math.abs(diff.offsetX) + Math.abs(diff.offsetY);
                logMovementDesync(diff);
            }
            localPacman.position = sharedPacmanMap.get('position');
        } else if (event.property == 'lives') {
            localPacman.lives = sharedPacmanMap.get('lives');
        } else if (event.property == 'score') {
            localPacman.score = sharedPacmanMap.get('score');
        } else if (event.property == 'direction') {
            localPacman.direction = sharedPacmanMap.get('direction');
        } else if (event.property == 'due') {
            localPacman.due = sharedPacmanMap.get('due');
        } else if (event.property == 'biscuitsEaten') {
            localPacman.biscuitsEaten = sharedPacmanMap.get('biscuitsEaten');
        }
    }

    function gameStateChanged(event) {
        console.log("New game state:", getState());
        if (event.property == 'state') {
            var state = getState();
            switch (state) {
                case STATE.COUNTDOWN:
                    timerStart = tick;
                    break;
                case STATE.DYING:
                    timerStart = tick;
                    break;
                case STATE.FINISHED:
                    saveLogs();
                    break;
            }
        }
    }

    function saveTextAsFile(title, text) {
        var textFileAsBlob = new Blob([text], {type: 'text/plain'});
        var downloadLink = document.createElement("a");
        downloadLink.download = title;
        downloadLink.innerHTML = "Download File";
        if (window.webkitURL != null) {
            // Chrome allows the link to be clicked
            // without actually adding it to the DOM.
            downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
        }
        else {
            // Firefox requires the link to be added to the DOM
            // before it can be clicked.
            downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
            //downloadLink.onclick = destroyClickedElement;
            downloadLink.style.display = "none";
            document.body.appendChild(downloadLink);
        }

        downloadLink.click();
    }

    function keyPress(e) {
        if (getState() !== STATE.WAITING && getState() !== STATE.PAUSE) {
            //e.preventDefault();
            //e.stopPropagation();
        }
    }

    function drawFooter() {

        var topLeft = (map.height * map.blockSize),
            textBase = topLeft + 17;

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, topLeft, (map.width * map.blockSize), 30);

        ctx.fillStyle = "#FFFF00";

        for (var i = 0, len = localPacman.lives; i < len; i++) {
            ctx.fillStyle = "#FFFF00";
            ctx.beginPath();
            ctx.moveTo(150 + (25 * i) + map.blockSize / 2, (topLeft + 1) + map.blockSize / 2);

            ctx.arc(150 + (25 * i) + map.blockSize / 2, (topLeft + 1) + map.blockSize / 2,
                map.blockSize / 2, Math.PI * 0.25, Math.PI * 1.75, false);
            ctx.fill();
        }

        /*
         ctx.fillStyle = !soundDisabled() ? "#00FF00" : "#FF0000";
         ctx.font = "bold 16px sans-serif";
         //ctx.fillText("♪", 10, textBase);
         ctx.fillText("s", 10, textBase);
         */

        ctx.fillStyle = "#FFFF00";
        ctx.font = "14px BDCartoonShoutRegular";
        ctx.fillText("Score: " + localPacman.score, 30, textBase);
    }

    function draw() {
        var i, diff;
        map.draw(ctx);
        drawFooter();
        switch (getState()) {
            case STATE.PLAYING:
                for (i = 0; i < localGhosts.length; i += 1)
                    localGhosts[i].draw(ctx);
                localPacman.draw(ctx);
                break;
            case STATE.DYING:
                for (i = 0; i < localGhosts.length; i += 1)
                    localGhosts[i].draw(ctx);
                localPacman.drawDead(ctx, (tick - timerStart) / (Pacman.FPS * 2));
                break;
            case STATE.WAITING:
                dialog("Press N to start a New game");
                break;
            case STATE.PAUSE:
                dialog("Paused");
                break;
            case STATE.COUNTDOWN:
                diff = Math.floor(5 - secondsAgo(timerStart));
                dialog("Starting in: " + diff);
                break;
            case STATE.FINISHED:
                dialog("Game finished");
                break;
        }
    }

    function dialog(text) {
        ctx.fillStyle = "#FFFF00";
        ctx.font = "14px BDCartoonShoutRegular";
        var width = ctx.measureText(text).width,
            x = ((map.width * map.blockSize) - width) / 2;
        ctx.fillText(text, x, (map.height * 10) + 8);
    }

    function keyDown(e) {
        if (e.keyCode === KEY.N) {
            if (getState() == STATE.WAITING) {
                setState(STATE.COUNTDOWN);
            }
        } else if (e.keyCode === KEY.P) {
            if (getState() == STATE.PAUSE) {
                pause();
            } else {
                resume();
            }
        } else if (getState() !== STATE.PAUSE) {
            if (typeof keyMap[e.keyCode] !== "undefined") {
                if (controlling == 'pacman') {
                    sharedPacmanMap.set('due', keyMap[e.keyCode]);
                } else if (controlling == 'ghost0') {
                    sharedGhostsMap[0].set('due', keyMap[e.keyCode]);
                } else if (controlling == 'ghost1') {
                    sharedGhostsMap[1].set('due', keyMap[e.keyCode]);
                } else if (controlling == 'ghost2') {
                    sharedGhostsMap[2].set('due', keyMap[e.keyCode]);
                } else if (controlling == 'ghost3') {
                    sharedGhostsMap[3].set('due', keyMap[e.keyCode]);
                }
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            return true;
        }
        return true;
    }

    return {
        "init": init,
        "getTick": getTick,
        "isPacman": isPacman,
        "isPlayerControlled": isPlayerControlled
    };
}

Object.prototype.clone = function () {
    var i, newObj = (this instanceof Array) ? [] : {};
    for (i in this) {
        if (i === 'clone') {
            continue;
        }
        if (this[i] && typeof this[i] === "object") {
            newObj[i] = this[i].clone();
        } else {
            newObj[i] = this[i];
        }
    }
    return newObj;
};
