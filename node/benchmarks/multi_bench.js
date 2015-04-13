// Copyright (c) 2015 Uber Technologies, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var async = require('async');
var parseArgs = require('minimist');
var argv = parseArgs(process.argv.slice(2), {
    alias: {
        m: 'multiplicity',
        c: 'numClients',
        r: 'numRequests'
    }
});
var multiplicity = parseInt(argv.multiplicity, 10) || 2;
var numClients = parseInt(argv.numClients, 10) || 5;
var numRequests = parseInt(argv.numRequests, 10) || 20000;

var TChannel = require("../channel"),
    metrics = require("metrics"),
    tests = [],
    clientOptions = {
        returnBuffers: false
    };

function Test(args) {
    this.args = args;

    this.arg1 = new Buffer(args.command);
    this.arg2 = args.args ? new Buffer(args.args) : null;
    this.arg3 = null;

    this.callback = null;
    this.clients = [];
    this.clientsReady = 0;
    this.commandsSent = 0;
    this.commandsCompleted = 0;
    this.maxPipeline = this.args.pipeline || numRequests;
    this.clientOptions = args.clientOptions || clientOptions;

    this.connectLatency = new metrics.Histogram();
    this.readyLatency = new metrics.Histogram();
    this.commandLatency = new metrics.Histogram();
}

Test.prototype.copy = function () {
    return new Test(this.args);
};

Test.prototype.run = function (callback) {
    var self = this;
    var i;

    this.callback = callback;

    var ids = [];
    for (i = 0; i < numClients ; i++) ids.push(i);
    async.each(ids, function each(i, done) {
        self.newClient(i, done);
    }, function(err) {
        if (err) {
            console.error('failed to setup clients', err);
        } else {
            self.start();
        }
    });
};

Test.prototype.newClient = function (id, callback) {
    var self = this;
    var port = 4041 + id;
    var newClient = new TChannel();
    newClient.createTime = Date.now();
    newClient.listen(port, "127.0.0.1", function (err) {
        if (err) return callback(err);
        self.clients[id] = newClient;
        // sending a ping to pre-connect the socket
        newClient
            .request({host: '127.0.0.1:4040'})
            .send('ping', null, null, function(err) {
                if (err) return callback(err);
                self.connectLatency.update(Date.now() - newClient.createTime);
                self.readyLatency.update(Date.now() - newClient.createTime);
                callback();
            });
    });
};

Test.prototype.start = function () {
    this.testStart = Date.now();
    this.fillPipeline();
};

Test.prototype.fillPipeline = function () {
    var pipeline = this.commandsSent - this.commandsCompleted;

    while (this.commandsSent < numRequests && pipeline < this.maxPipeline) {
        this.commandsSent++;
        pipeline++;
        this.sendNext();
    }

    if (this.commandsCompleted === numRequests) {
        this.printStats();
        this.stopClients();
    }
};

Test.prototype.stopClients = function () {
    var self = this;

    this.clients.forEach(function (client, pos) {
        if (pos === self.clients.length - 1) {
            client.quit(function () {
                self.callback();
            });
        } else {
            client.quit();
        }
    });
};

Test.prototype.sendNext = function () {
    var self = this;
    var curClient = this.commandsSent % this.clients.length;
    var start = Date.now();

    this.clients[curClient]
        .request({
            host: '127.0.0.1:4040',
            timeout: 10000,
            service: 'benchmark',
            headers: {
                benchHeader1: 'bench value one',
                benchHeader2: 'bench value two',
                benchHeader3: 'bench value three'
            }
        })
        .send(this.arg1, this.arg2, this.arg3, done);

    function done(err) {
        if (err) {
            throw err;
        }
        self.commandsCompleted++;
        self.commandLatency.update(Date.now() - start);
        self.fillPipeline();
    }
};

Test.prototype.getStats = function () {
    var obj = this.commandLatency.printObj();
    obj.descr = this.args.descr;
    obj.pipeline = this.args.pipeline;
    obj.numClients = this.clientsReady;
    obj.elapsed = Date.now() - this.testStart;
    obj.rate = numRequests / (obj.elapsed / 1000);
    return obj;
};

Test.prototype.printStats = function () {
    var obj = this.getStats();
    process.stdout.write(JSON.stringify(obj) + "\n");
};

var smallStr = "1234";
var largeStr = new Array(4097).join("-");
var smallStrSet = JSON.stringify(['foo_rand000000000000', smallStr]);
var smallBufSet = new Buffer(smallStrSet);
var largeStrSet = JSON.stringify(['foo_rand000000000001', largeStr]);
var largeBufSet = new Buffer(largeStrSet);

tests.push(new Test({descr: "PING", command: "ping", args: null, pipeline: 1}));
tests.push(new Test({descr: "PING", command: "ping", args: null, pipeline: 50}));
tests.push(new Test({descr: "PING", command: "ping", args: null, pipeline: 200}));
tests.push(new Test({descr: "PING", command: "ping", args: null, pipeline: 20000}));

tests.push(new Test({descr: "SET small str", command: "set", args: smallStrSet, pipeline: 1}));
tests.push(new Test({descr: "SET small str", command: "set", args: smallStrSet, pipeline: 50}));
tests.push(new Test({descr: "SET small str", command: "set", args: smallStrSet, pipeline: 200}));
tests.push(new Test({descr: "SET small str", command: "set", args: smallStrSet, pipeline: 20000}));

tests.push(new Test({descr: "SET small buf", command: "set", args: smallBufSet, pipeline: 1}));
tests.push(new Test({descr: "SET small buf", command: "set", args: smallBufSet, pipeline: 50}));
tests.push(new Test({descr: "SET small buf", command: "set", args: smallBufSet, pipeline: 200}));
tests.push(new Test({descr: "SET small buf", command: "set", args: smallBufSet, pipeline: 20000}));

tests.push(new Test({descr: "GET small str", command: "get", args: "foo_rand000000000000", pipeline: 1}));
tests.push(new Test({descr: "GET small str", command: "get", args: "foo_rand000000000000", pipeline: 50}));
tests.push(new Test({descr: "GET small str", command: "get", args: "foo_rand000000000000", pipeline: 200}));
tests.push(new Test({descr: "GET small str", command: "get", args: "foo_rand000000000000", pipeline: 20000}));

tests.push(new Test({descr: "SET large str", command: "set", args: largeStrSet, pipeline: 1}));
tests.push(new Test({descr: "SET large str", command: "set", args: largeStrSet, pipeline: 50}));
tests.push(new Test({descr: "SET large str", command: "set", args: largeStrSet, pipeline: 200}));
tests.push(new Test({descr: "SET large str", command: "set", args: largeStrSet, pipeline: 20000}));

tests.push(new Test({descr: "SET large buf", command: "set", args: largeBufSet, pipeline: 1}));
tests.push(new Test({descr: "SET large buf", command: "set", args: largeBufSet, pipeline: 50}));
tests.push(new Test({descr: "SET large buf", command: "set", args: largeBufSet, pipeline: 200}));
tests.push(new Test({descr: "SET large buf", command: "set", args: largeBufSet, pipeline: 20000}));

tests.push(new Test({descr: "GET large str", command: "get", args: 'foo_rand000000000001', pipeline: 1}));
tests.push(new Test({descr: "GET large str", command: "get", args: 'foo_rand000000000001', pipeline: 50}));
tests.push(new Test({descr: "GET large str", command: "get", args: 'foo_rand000000000001', pipeline: 200}));
tests.push(new Test({descr: "GET large str", command: "get", args: 'foo_rand000000000001', pipeline: 20000}));

function next(i, j, done) {
    if (i >= tests.length) return done();
    if (j >= multiplicity) return next(i+1, 0, done);
    var test = tests[i].copy();
    test.run(function () {
        next(i, j+1, done);
    });
}

next(0, 0, function() {
    process.exit(0);
});