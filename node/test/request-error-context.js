// Copyright (c) 2015 Uber Technologies, Inc.
//
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

'use strict';

var allocCluster = require('./lib/alloc-cluster.js');

allocCluster.test('request() without hasNoParent', {
    numPeers: 2
}, function t(cluster, assert) {
    var one = remoteService(cluster.channels[0]);
    var two = cluster.channels[1];

    var subTwo = two.makeSubChannel({
        serviceName: 'server',
        peers: [one.hostPort]
    });

    subTwo.waitForIdentified({
        host: one.hostPort
    }, function onIdentified(err) {
        assert.ifError(err);

        var error = getError(function throwIt() {
            subTwo.request({
                serviceName: 'server'
            }).send('echo', 'a', 'b');
        });
        assert.ok(error.message.indexOf('For the call to server') >= 0);

        assert.end();
    });
});

allocCluster.test('request() without as header', {
    numPeers: 2
}, function t(cluster, assert) {
    var one = remoteService(cluster.channels[0]);
    var two = cluster.channels[1];

    var subTwo = two.makeSubChannel({
        serviceName: 'server',
        peers: [one.hostPort]
    });

    subTwo.waitForIdentified({
        host: one.hostPort
    }, function onIdentified(err) {
        assert.ifError(err);

        var error = getError(function throwIt() {
            subTwo.request({
                serviceName: 'server',
                hasNoParent: true
            }).send('echo', 'a', 'b', noop);
        });
        assert.ok(error.message.indexOf(
            'Got request for server echo without as header'
        ) >= 0);

        // purge orphaned out req.
        subTwo.peers.get(one.hostPort).connections[0].ops.clear();

        assert.end();
    });
});

allocCluster.test('request() without cn header', {
    numPeers: 2
}, function t(cluster, assert) {
    var one = remoteService(cluster.channels[0]);
    var two = cluster.channels[1];

    var subTwo = two.makeSubChannel({
        serviceName: 'server',
        peers: [one.hostPort]
    });

    subTwo.waitForIdentified({
        host: one.hostPort
    }, function onIdentified(err) {
        assert.ifError(err);

        var error = getError(function throwIt() {
            subTwo.request({
                serviceName: 'server',
                hasNoParent: true,
                headers: {
                    as: 'raw'
                }
            }).send('echo', 'a', 'b', noop);
        });

        // purge orphaned out req.
        subTwo.peers.get(one.hostPort).connections[0].ops.clear();

        assert.ok(error.message.indexOf(
            'Got request for server echo without cn header'
        ) >= 0);

        assert.end();
    });
});

function noop() {}

function getError(fn) {
    var error = null;

    try {
        fn();
    } catch (err) {
        error = err;
    }

    return error;
}

function remoteService(chan) {
    chan.makeSubChannel({
        serviceName: 'server'
    }).register('echo', function echo(req, res, arg2, arg3) {
        res.headers.as = 'raw';
        res.sendOk(arg2, arg3);
    });

    return chan;
}
