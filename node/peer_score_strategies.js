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

module.exports.PreferOutgoingHandler = PreferOutgoingHandler;

function PreferOutgoingHandler(peer) {
    var self = this;

    self.peer = peer;
    self.lastQOS = self.getQOS();
}

PreferOutgoingHandler.UNCONNECTED = 0;
PreferOutgoingHandler.ONLY_INCOMING = 1;
PreferOutgoingHandler.FRESH_OUTGOING = 2;
PreferOutgoingHandler.READY_OUTGOING = 3;

PreferOutgoingHandler.prototype.getQOS = function getQOS() {
    var self = this;

    var inconn = self.peer.getInConnection();
    var outconn = self.peer.getOutConnection();

    if (!inconn && !outconn) {
        return PreferOutgoingHandler.UNCONNECTED;
    } else if (!outconn || outconn.direction !== 'out') {
        return PreferOutgoingHandler.ONLY_INCOMING;
    } else if (outconn.remoteName === null) {
        return PreferOutgoingHandler.FRESH_OUTGOING;
    } else {
        return PreferOutgoingHandler.READY_OUTGOING;
    }
};

PreferOutgoingHandler.prototype.shouldRequest = function shouldRequest() {
    var self = this;

    // space:
    //   [0.1, 0.4)  peers with no identified outgoing connection
    //   [0.4, 1.0)  identified outgoing connections
    var random = self.peer.outPendingWeightedRandom();
    var qos = self.getQOS();
    if (self.lastQOS !== qos) {
        self.lastQOS = qos;
    }
    switch (qos) {
        case PreferOutgoingHandler.ONLY_INCOMING:
            if (!self.peer.channel.destroyed) {
                self.peer.connect();
            }
            /* falls through */
        case PreferOutgoingHandler.UNCONNECTED:
            /* falls through */
        case PreferOutgoingHandler.FRESH_OUTGOING:
            return 0.1 + random * 0.3;
        case PreferOutgoingHandler.READY_OUTGOING:
            return 0.4 + random * 0.6;
    }
};
