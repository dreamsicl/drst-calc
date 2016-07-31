var app = angular.module('calc', []);

app.factory('Data', function() {
    var ret = {};

    ret.data = {
        timeLeft: ''
    };

    ret.getTimeLeft = function() {
        return ret.data.timeLeft
    };
    ret.setTimeLeft = function(time) {
        ret.data.timeLeft = time
    };

    return ret;
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

app.controller('timeCtrl', function($scope, $http, $timeout, Data) {
    var url = "https://crossorigin.me/https://starlight.kirara.ca/api/v1/happening/now";
    $scope.deadline = null;

    $scope.$watch('deadline', function(newValue, oldValue) {
        $http.get(url).then(function(response) {
            $scope.deadline = response.data.events[0].end_date*1000;
        }, function(response) {
            $scope.deadline = "could not load event";
        })
        if (newValue !== oldValue) {
          $scope.deadline = n;
        }
    });

    /** clock **/
    $scope.clock = Date.now();
    Data.setTimeLeft(0);
    var tickInterval = 1000;
    var tick = function() {
        if ($scope.deadline) {
            $scope.ms = $scope.deadline - $scope.clock;
            Data.setTimeLeft($scope.ms);
        }
        $scope.clock = Date.now();
        $timeout(tick, tickInterval);
    }
    $timeout(tick, tickInterval);
});

app.controller('liveController', function($scope, $filter, Data, NormalLive, TokenLive, Exp) {
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
    $scope.norm.stam = $scope.staminas[0]; // set default

    /**** score settings ***/
    $scope.scores = ['S', 'A', 'B', 'C'];
    $scope.norm.score = $scope.scores[0]; // set default
    $scope.tokn.score = $scope.scores[0];

    /*** event difficulty ***/
    $scope.difficulties = ['Debut', 'Regular', 'Pro', 'Master/Master+'];
    $scope.tokn.diff = $scope.difficulties[0]; // set default

    /*** multipliers ***/
    $scope.nmuls = [1, 2];
    $scope.norm.mul = $scope.nmuls[0];
    $scope.tmuls = [1, 2, 4];
    $scope.tokn.mul = $scope.tmuls[0];

    /** status defaults **/
    $scope.user.lvl = 2;
    $scope.user.exp = 0;
    $scope.user.pts = 0;
    $scope.user.tok = 0;
    $scope.user.end = 5000;

    var lvlInfo = $filter('filter')(Exp, {
        "Level": $scope.user.lvl
    })[0];
    var ptDeficit = $scope.user.end - $scope.user.pts;
    var getExpInfo = function(currExp) {
        for (var key in lvlInfo) {
            if (key === "EXP to Next") $scope.user.expToNext = lvlInfo[key];
            if (key === "Total EXP") $scope.user.totalExp = lvlInfo[key] + currExp;
            ptDeficit = $scope.user.end - $scope.user.pts;
        }
    }
    getExpInfo($scope.user.exp);

    $scope.updateStatus = function() {
        if ($scope.user.lvl > 300) $scope.user.lvl = 300;
        lvlInfo = $filter('filter')(Exp, {
            "Level": $scope.user.lvl
        })[0];
        getExpInfo($scope.user.exp);
        if ($scope.user.exp > $scope.user.expToNext) $scope.user.exp = $scope.user.expToNext;
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

    // event lives: get token cost, point worth, & exp
    var totalPtsTokn = $scope.tokn.cost + $scope.tokn.ptsEarned;
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

    /******** calculate output data *******/

    // reused vars

    // total event lives needed
    $scope.calcEventLivesNeeded = function() {
        return Math.floor(ptDeficit / totalPtsTokn)
    }

    $scope.calcNormalLivesNeeded = function() {
        var ePlay = $scope.calcEventLivesNeeded();
        var tokNeed = ePlay * $scope.tokn.cost * $scope.tokn.mul;
        var nPlay = (tokNeed - $scope.user.tok) / ($scope.norm.toknEarn);
        var extraNorm = Math.ceil((ptDeficit - totalPtsTokn * ePlay) / $scope.norm.toknEarn);
        if (extraNorm > 0) {
            nPlay += extraNorm;
        }
        return nPlay;
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

    $scope.timeLeft = 0;
    $scope.$watch(function() {
        return Data.getTimeLeft();
    }, function(n, o) {
        if (n !== o) {
            $scope.timeLeft = n;
            $scope.naturalStam = Math.floor(n / 1000 / 60 / 5);
        }
    })
    $scope.calcStamDeficit = function() {
        var nPlay = $scope.calcNormalLivesNeeded();
        var endRank = $scope.calcEndRank();

        var staFromLevelUp = 0;
        for (var i = $scope.user.lvl + 1; i <= endRank; i++) {
            staFromLevelUp += Exp[i - 1]["Stamina"];
        }
        return Math.max($scope.norm.stam * nPlay - staFromLevelUp - $scope.naturalStam, 0);
    }

    // play time in minutes
    $scope.calcPlayTime = function() {
        var ePlay = $scope.calcEventLivesNeeded();
        var nPlay = $scope.calcNormalLivesNeeded();
        return (ePlay + nPlay) * 2.25;
    }

    // time left/play time
    $scope.enoughTime = function () {
      var playTime = $scope.calcPlayTime();
      return playTime < $scope.timeLeft;
    }

});
