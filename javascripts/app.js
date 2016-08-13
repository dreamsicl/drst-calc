var app = angular.module('calc', ['bsLoadingOverlay', 'bsLoadingOverlaySpinJs', 'bsLoadingOverlayHttpInterceptor', 'LocalStorageModule', 'ui.bootstrap', 'ui.router', 'ngAnimate']);

app.run(function(bsLoadingOverlayService) {
    bsLoadingOverlayService.setGlobalConfig({
        templateUrl: 'loading-overlay.html'
    });
});

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
        })
        .state("party", {
            url: "/party",
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
    }, {
        heading: "Live Party",
        route: "party",
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

app.factory('Time', function($http) {
    var ret = {};

    ret.getTimedInfo = function(url) {
        return $http.get(url);
    }
    return ret;
});

app.factory('Data', function() {
    var data = {
        collapse: '',
    };
    data.getCollapse = function() {
        return data.collapse
    };
    data.setCollapse = function(collapse) {
        data.collapse = collapse
    };
    return data;
});


app.controller('TokenCtrl', function($scope, $interval, $timeout, Time, $filter, NormalLive, TokenLive, Exp, localStorageService, bsLoadingOverlayService) {

    $scope.collapse = {
        time: false,
        status: false,
        song: false,
        results: false
    };

    var localCollapse = localStorageService.get('collapse');
    if (localCollapse != null) {
        $scope.collapse = localCollapse;
    }

    $scope.setLocalCollapse = function() {
        localStorageService.set('collapse', $scope.collapse);
        var localCollapse = localStorageService.get('collapse');
    }


    /*** timing settings ****/
    var getDeadlineSuccess = function(data, status) {
        $scope.time.deadline = data.events[0].end_date * 1000;
    }
    var url = "https://starlight.kirara.ca/api/v1/happening/now";
    var getDeadline = function() {
        Time.getTimedInfo(url).success(getDeadlineSuccess);
    };

    $scope.time = {};
    $scope.time.remainingMs = "Loading...";
    $scope.time.naturalStam = "Loading...";
    $scope.time.clock = "Loading...";
    var promise;
    var stopInterval = function() {
        $interval.cancel(promise);
        $scope.time.remainingMs = "Loading...";
        $scope.time.naturalStam = "Loading...";
        $scope.time.clock = "Loading...";
    }
    var startInterval = function() {
        stopInterval();
        promise = $interval(function() {
            $scope.time.clock = Date.now();
            $scope.time.remainingMs = $scope.time.deadline - $scope.time.clock;
            $scope.time.naturalStam = Math.floor($scope.time.remainingMs / 1000 / 60 / 5);
        }, 1000);
    }

    $scope.updateTimeHrs = function() {
        $scope.time.remainingMs = $scope.time.hours * 3600000;
        $scope.time.deadline = Date.now() + $scope.time.remainingMs;
        $scope.time.naturalStam = Math.floor($scope.time.remainingMs / 1000 / 60 / 5);
        localStorageService.set('timeHrs', $scope.time.hours);
    };
    $scope.updateTimeKind = function(kind) {
        $scope.time.kind = kind;
        if (kind == 'auto') {
            bsLoadingOverlayService.wrap({}, $timeout(angular.noop, 1300));
            $scope.time.deadline = getDeadline();
            startInterval();
        } else {
            stopInterval();
            $scope.updateTimeHrs();
        }
        localStorageService.set('timeKind', kind);
    }

    var localTimeHrs = localStorageService.get('timeHrs');
    var localTimeKind = localStorageService.get('timeKind');

    $scope.initTime = function() {
        $scope.time.deadline = false;
        if (localTimeKind == null) {
            $scope.updateTimeKind('auto');
        } else {
            $scope.updateTimeKind(localTimeKind);
        }
        if (localTimeHrs == null) $scope.time.hours = 198;
        else $scope.time.hours = localTimeHrs;

        $scope.updateTimeHrs();
        $scope.updateTimeKind($scope.time.kind);

    };


    /***** gather input *****/
    $scope.norm = {};
    $scope.tokn = {};
    $scope.user = {};

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
        return Math.max(Math.floor(($scope.user.end - $scope.user.pts) / ($scope.tokn.cost + $scope.tokn.ptsEarned)), 0);
    }

    $scope.calcNormalLivesNeeded = function() {
        var ePlay = $scope.calcEventLivesNeeded();
        var totalToknsNeeded = ePlay * $scope.tokn.cost;

        var nPlay = Math.ceil((totalToknsNeeded - $scope.user.tok) / $scope.norm.toknEarn);

        var extraNorm = Math.ceil((($scope.user.end - $scope.user.pts) - ($scope.tokn.cost + $scope.tokn.ptsEarned) * ePlay) / $scope.norm.toknEarn);
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
                endRank = Exp[i - 1]["Level"];
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
        $scope.playTime = (ePlay + nPlay) * 2.25;
        return (ePlay + nPlay) * 2.25;
    }

    // time left/play time
    $scope.enoughTime = function() {
        return $scope.playTime < ($scope.time.remainingMs / 1000 / 60);
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
    $scope.calcPointsPerDay = function() {
        var daysLeft = Math.floor($scope.time.remainingMs / 1000 / 60 / 60 / 24);
        return ptDeficit / daysLeft;
    }
});

app.controller('GrooveCtrl', function($scope, Time, $interval, $timeout, Exp, bsLoadingOverlayService, localStorageService, Encore, $filter) {
    $scope.grooveCollapse = {
        time: false,
        status: false,
        song: false,
        results: false
    };

    var localCollapse = localStorageService.get('grooveCollapse');
    if (localCollapse != null) {
        $scope.grooveCollapse = localCollapse;
    }

    $scope.setLocalCollapse = function() {
        localStorageService.set('grooveCollapse', $scope.grooveCollapse);
    }


    /*** timing settings ****/
    $scope.time = {};
    var getDeadlineSuccess = function(data, status) {
        $scope.time.deadline = data.events[0].end_date * 1000;
    }
    var url = "https://starlight.kirara.ca/api/v1/happening/now";
    var getDeadline = function() {
        Time.getTimedInfo(url).success(getDeadlineSuccess);
    };

    $scope.time = {};
    $scope.time.remainingMs = "Loading...";
    $scope.time.naturalStam = "Loading...";
    $scope.time.clock = "Loading...";
    var promise;
    var stopInterval = function() {
        $interval.cancel(promise);
        $scope.time.remainingMs = "Loading...";
        $scope.time.naturalStam = "Loading...";
        $scope.time.clock = "Loading...";
    }
    var startInterval = function() {
        stopInterval();
        promise = $interval(function() {
            $scope.time.clock = Date.now();
            $scope.time.remainingMs = $scope.time.deadline - $scope.time.clock;
            $scope.time.naturalStam = Math.floor($scope.time.remainingMs / 1000 / 60 / 5);
        }, 1000);
    }

    $scope.updateTimeHrs = function() {
        $scope.time.remainingMs = $scope.time.hours * 3600000;
        $scope.time.deadline = Date.now() + $scope.time.remainingMs;
        $scope.time.naturalStam = Math.floor($scope.time.remainingMs / 1000 / 60 / 5);
        localStorageService.set('timeHrs', $scope.time.hours);
    };
    $scope.updateTimeKind = function(kind) {
        $scope.time.kind = kind;
        if (kind == 'auto') {
            bsLoadingOverlayService.wrap({}, $timeout(angular.noop, 1300));
            $scope.time.deadline = getDeadline();
            startInterval();
        } else {
            stopInterval();
            $scope.updateTimeHrs();
        }
        localStorageService.set('timeKind', kind);
    }

    var localTimeHrs = localStorageService.get('timeHrs');
    var localTimeKind = localStorageService.get('timeKind');

    $scope.initTime = function() {
        $scope.time.deadline = false;
        if (localTimeKind == null) {
            $scope.updateTimeKind('auto');
        } else {
            $scope.updateTimeKind(localTimeKind);
        }
        if (localTimeHrs == null) $scope.time.hours = 198;
        else $scope.time.hours = localTimeHrs;

        $scope.updateTimeHrs();
        $scope.updateTimeKind($scope.time.kind);

    };

    $scope.grve = {};
    $scope.encr = {};
    $scope.user = {};

    /**** groove settings *****/
    $scope.grve.diff = "Debut";
    $scope.grve.score = "S";

    $scope.encr.diff = "Debut";
    $scope.encr.score = "S";

    $scope.applauseLevels = ['Average', '50+']
    for (var i = 49; i > 0; i--) {
        $scope.applauseLevels.push(i);
    }
    $scope.grve.appl = $scope.applauseLevels[0];




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
        localStorageService.set('user', $scope.user);
    }

});



var modalController = function($scope, $uibModalInstance) {
    $scope.close = function() {
        $uibModalInstance.close();
    };
};

modalController.$inject = ['$scope', '$uibModalInstance'];

app.controller('ChangelogCtrl', function($scope, $uibModal) {
    $scope.open = function(size) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'changelog.html',
            controller: modalController,
            size: size,
            resolve: {}
        });
    };
})

app.controller('ResourcesCtrl', function($scope, $uibModal) {
    $scope.open = function(size) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'resources.html',
            controller: modalController,
            size: size,
            resolve: {}
        });
    };
})
