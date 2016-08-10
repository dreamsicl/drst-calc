var app = angular.module('calc', ['LocalStorageModule', 'ui.bootstrap', 'ui.router', 'ngAnimate']);

app.config(function(localStorageServiceProvider) {
    localStorageServiceProvider
        .setPrefix('calc')
        .setStorageType('localStorage')
        .setNotify(true, true)
});

app.config(function($stateProvider, $urlRouterProvider) {

    $urlRouterProvider.otherwise("/token");

    $stateProvider
        .state("default", {
            abstract: true,
            url: "/",
            templateUrl: "token.html"
        })
        .state("token", {
            url: "/token",
            templateUrl: "token.html"
        })
        .state("groove", {
            url: "/groove",
            templateUrl: "foreshadowing.html"
        });
});

app.controller('TabCtrl', function($rootScope, $scope, $state) {
    $scope.tabs = [{
        heading: "Token",
        route: "token",
        active: true
    }, {
        heading: "Live Groove",
        route: "groove",
        active: false
    }, ];

    $scope.go = function(route) {
        $state.go(route);
    };

    $scope.active = function(route) {
        return $state.is(route);
    };

    $scope.$on("$stateChangeSuccess", function() {
        $scope.tabs.forEach(function(tab) {
            tab.active = $scope.active(tab.route);
        });
    });
});

app.filter('time', function() {

    var conversions = {
        'ss': angular.identity,
        'mm': function(value) {
            return value * 60;
        },
        'hh': function(value) {
            return value * 3600;
        }
    };

    var padding = function(value, length) {
        var zeroes = length - ('' + (value)).length,
            pad = '';
        while (zeroes-- > 0) pad += '0';
        return pad + value;
    };

    return function(value, unit, format, isPadded) {
        var totalSeconds = conversions[unit || 'ss'](value),
            hh = Math.floor(totalSeconds / 3600),
            mm = Math.floor((totalSeconds % 3600) / 60),
            ss = totalSeconds % 60;

        format = format || 'hh:mm:ss';
        isPadded = angular.isDefined(isPadded) ? isPadded : true;
        hh = isPadded ? padding(hh, 2) : hh;
        mm = isPadded ? padding(mm, 2) : mm;
        ss = isPadded ? padding(ss, 2) : ss;

        return format.replace(/hh/, hh).replace(/mm/, mm).replace(/ss/, ss);
    };
});
app.directive("regExInput", function() {
    "use strict";
    return {
        restrict: "A",
        require: "?regEx",
        scope: {},
        replace: false,
        link: function(scope, element, attrs, ctrl) {
            element.bind('keypress', function(event) {
                var regex = new RegExp(attrs.regEx);
                var key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
                if (!regex.test(key)) {
                    event.preventDefault();
                    return false;
                }
            });
        }
    };
});

app.factory('autoDeadline', function($http, $timeout) {
    var deadline = {};
    var url = "https://crossorigin.me/https://starlight.kirara.ca/api/v1/happening/now";
    deadline = false;

    $http.get(url).then(function(response) {
        deadline = response.data.events[0].end_date * 1000;
    }, function(response) {
        deadline = false;
    })

    return deadline;
});

app.factory('Data', function() {
    var data = {
        user: '',
    };
    data.getData
    return data;
});


app.controller('TokenCtrl', function($scope, $timeout, autoDeadline, $filter, NormalLive, TokenLive, Exp, localStorageService) {
    $scope.$watch('panelSize', (function(n, o) {
        if (n !== o) $scope.panelSize = n;
    }));
    $scope.collapse = {
        time: false,
        song: false,
        status: false,
        results: false
    };
    /*** timing settings ****/
    $scope.time = {};


    $scope.time.remainingMs = "Loading...";
    $scope.time.naturalStam = "Loading...";

    var localTimeHrs = localStorageService.get('timeHrs');
    var localTimeKind = localStorageService.get('timeKind');
    if (localTimeKind == null) {
        $scope.time.kind = 'auto';
        $scope.time.hours = 194;
    } else {
        $scope.time.kind = localTimeKind;
        $scope.time.hours = localTimeHrs;
        $scope.time.deadline = Date.now() + $scope.time.hours * 3600000;

    }

    $scope.initTime = function(kind) {

        $scope.time.kind = kind;
        $scope.time.remainingMs = "Loading...";
        $scope.time.naturalStam = "Loading...";
        if ($scope.time.kind == 'auto') {
            $scope.time.deadline = autoDeadline;
            localStorageService.set('timeKind', 'auto');
        } else if ($scope.time.kind == 'manu') {
            $scope.time.deadline = Date.now() + $scope.time.hours * 3600000;
            localStorageService.set('timeKind', 'manu');
        }
    };
    $scope.updateTimeHrs = function() {
        $scope.time.deadline = Date.now() + $scope.time.hours * 3600000;
        $scope.time.remainingMs = $scope.time.deadline - $scope.time.clock;
        $scope.time.naturalStam = Math.floor($scope.time.remainingMs / 1000 / 60 / 5);

    };
    $scope.setLocalStorageTime = function() {
            localStorageService.set('timeHrs', $scope.time.hours);
        }
        /** clock **/
    $scope.time.clock = Date.now();
    var tickInterval = 1000;
    var tick = function() {
        if ($scope.time.deadline) {
            $scope.time.remainingMs = $scope.time.deadline - $scope.time.clock;
            $scope.time.naturalStam = Math.floor($scope.time.remainingMs / 1000 / 60 / 5);
        }
        $scope.time.clock = Date.now();
        $timeout(tick, tickInterval);
    }
    $timeout(tick, tickInterval);


    /***** gather input *****/
    $scope.norm = {};
    $scope.tokn = {};
    $scope.user = {};
    /***** stamina settings *****/
    /** populate stam options **/
    $scope.staminas = [];
    for (var i = 10; i < 20; i++) {
        $scope.staminas.push(i);
    };



    var lvlInfo = $filter('filter')(Exp, {
        "Level": $scope.user.lvl
    })[0];
    var ptDeficit = $scope.user.end - $scope.user.pts;
    $scope.user.percentComplete = ($scope.user.pts / $scope.user.end) * 100;
    var getExpInfo = function(currExp) {
        for (var key in lvlInfo) {
            if (key === "EXP to Next") $scope.user.expToNext = lvlInfo[key];
            if (key === "Total EXP") $scope.user.totalExp = lvlInfo[key] + currExp;
            ptDeficit = $scope.user.end - $scope.user.pts;
        }
    }
    getExpInfo($scope.user.exp);

    $scope.updateStatus = function() {
        if ($scope.user.lvl > 300) {
            $scope.user.lvl = 300;
        }
        lvlInfo = $filter('filter')(Exp, {
            "Level": $scope.user.lvl
        })[0];
        getExpInfo($scope.user.exp);
        if ($scope.user.exp > $scope.user.expToNext) {
            $scope.user.exp = $scope.user.expToNext;
        }
        $scope.user.percentComplete = $scope.user.pts / $scope.user.end;
    }
    $scope.setLocalStorageUser = function() {
        localStorageService.set('user', $scope.user);
    }


    /*********** process input, get relevent constants ******/
    // normal lives: get tokens & exp
    var findNormByStam = $filter('filter')(NormalLive, {
        "Stamina": $scope.norm.stam
    })[0];
    var searchNorm = function(rank, m) {
        for (var key in findNormByStam) {
            if (key === rank) $scope.norm.toknEarn = findNormByStam[key] * m;
            if (key === "EXP") $scope.norm.exp = findNormByStam[key];
        }
    }
    searchNorm($scope.norm.score, $scope.norm.mul);
    $scope.updateNorm = function() {
        findNormByStam = $filter('filter')(NormalLive, {
            "Stamina": $scope.norm.stam
        })[0];
        searchNorm($scope.norm.score, $scope.norm.mul);
    };
    $scope.setLocalStorageNorm = function() {
        localStorageService.set('norm', $scope.norm);
    }


    // event lives: get token cost, point worth, & exp
    var totalPtsTokn = "";
    var findToknByDiff = $filter('filter')(TokenLive, {
        "Difficulty": $scope.tokn.diff
    })[0];
    var searchTokn = function(rank, m) {
        for (var key in findToknByDiff) {
            if (key === "Token Cost") $scope.tokn.cost = findToknByDiff[key] * m;
            if (key === $scope.tokn.score) $scope.tokn.ptsEarned = findToknByDiff[key] * m;
            if (key === "EXP") $scope.tokn.exp = findToknByDiff[key];
        }
        totalPtsTokn = $scope.tokn.cost + $scope.tokn.ptsEarned;
    }
    searchTokn($scope.tokn.score, $scope.tokn.mul);

    $scope.updateTokn = function() {
        findToknByDiff = $filter('filter')(TokenLive, {
            "Difficulty": $scope.tokn.diff
        })[0];
        searchTokn($scope.tokn.score, $scope.tokn.mul);
    };
    $scope.setLocalStorageTokn = function() {
        localStorageService.set('tokn', $scope.tokn);
    }


    $scope.formInit = function() {
        var localNorm = localStorageService.get('norm');
        var localTokn = localStorageService.get('tokn');
        var localUser = localStorageService.get('user');

        if (localNorm == null) {
            $scope.norm.stam = 10;
            $scope.norm.score = "S"; // set default
            $scope.norm.mul = 1;
        } else {
            $scope.norm = localNorm;
        }
        $scope.updateNorm();

        if (localTokn == null) {
            $scope.tokn.diff = "Debut";
            $scope.tokn.score = "S";
            $scope.tokn.mul = 1;
        } else {
            $scope.tokn = localTokn;
        }
        $scope.updateTokn();

        if (localUser == null) {
            $scope.user.lvl = 2;
            $scope.user.exp = 0;
            $scope.user.pts = 0;
            $scope.user.tok = 0;
            $scope.user.end = 5000;
        } else {
            $scope.user = localUser;
        }
        $scope.updateStatus();
    };

    /******** calculate output data *******/

    // reused vars

    // total event lives needed
    $scope.calcEventLivesNeeded = function() {
        return Math.max(Math.floor(ptDeficit / totalPtsTokn), 0);
    }

    $scope.calcNormalLivesNeeded = function() {
        var ePlay = $scope.calcEventLivesNeeded();
        var tokNeed = ePlay * $scope.tokn.cost * $scope.tokn.mul;
        var nPlay = Math.floor((tokNeed - $scope.user.tok) / ($scope.norm.toknEarn));
        var extraNorm = Math.ceil((ptDeficit - totalPtsTokn * ePlay) / $scope.norm.toknEarn);
        if (extraNorm > 0) {
            nPlay += extraNorm;
        }
        return Math.max(nPlay, 0);
    }

    $scope.calcEndRank = function() {
        var ePlay = $scope.calcEventLivesNeeded();
        var nPlay = $scope.calcNormalLivesNeeded();
        var expGain = ePlay * $scope.tokn.exp + nPlay * $scope.norm.exp;
        var endExp = $scope.user.totalExp + expGain;
        var endRank = $scope.user.lvl;
        for (var i = 0; i < Exp.length; i++) // iterate over all lvls
        {
            if (Exp[i]["Total EXP"] > endExp) {
                endRank = Exp[i]["Level"];
                break;
            }
        }
        return endRank;
    }


    $scope.calcStamDeficit = function() {
        var nPlay = $scope.calcNormalLivesNeeded();
        var endRank = $scope.calcEndRank();

        var staFromLevelUp = 0;
        for (var i = $scope.user.lvl + 1; i <= endRank; i++) {
            staFromLevelUp += Exp[i - 1]["Stamina"];
        }
        return Math.max($scope.norm.stam * nPlay - staFromLevelUp - $scope.time.naturalStam, 0);
    }

    // play time in minutes
    $scope.calcPlayTime = function() {
        var ePlay = $scope.calcEventLivesNeeded();
        var nPlay = $scope.calcNormalLivesNeeded();
        return (ePlay + nPlay) * 2.25;
    }

    // time left/play time
    $scope.enoughTime = function() {
        var playTime = $scope.calcPlayTime();
        return playTime < $scope.timeLeft;
    }

    // percent to goal
    $scope.getPercentCompletion = function() {
        return user.pts / user.end * 100;
    }

    $scope.calcNaturalPts = function() {
        var naturalNormPlays = Math.floor($scope.time.naturalStam / $scope.norm.stam);
        var naturalTokens = naturalNormPlays * $scope.norm.toknEarn;
        var naturalToknPlays = naturalTokens / $scope.tokn.cost;
        return naturalTokens + naturalToknPlays * $scope.tokn.ptsEarned;
    }
});

app.controller('GrooveCtrl', function($scope, autoTime) {
    $scope.time = autoTime;
    $scope.grve = {};
    $scope.user = {};

    /**** groove settings */
    $scope.grve.grooveDiff = "Debut";
    $scope.grve.grooveScore = "S";

    $scope.grve.encoreDiff = "Debut";
    $scope.grve.encoreScore = "S";

    $scope.grve.applauseLevels = ['Average', '50+']
    for (var i = 49; i > 0; i--) {
        $scope.grve.applauseLevels.push(i);
    }
    $scope.grve.appl = $scope.grve.applauseLevels[0];

});
