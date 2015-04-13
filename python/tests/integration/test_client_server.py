# Copyright (c) 2015 Uber Technologies, Inc.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.

from __future__ import absolute_import

import pytest

import tchannel.messages as tmessage
from tchannel import tcurl
from tchannel.exceptions import ConnectionClosedException
from tchannel.tornado import TChannel
from tchannel.tornado.connection import TornadoConnection
from tchannel.messages.error import ErrorCode
from tchannel.messages import Types
from tests.util import big_arg


@pytest.fixture
def call_response():
    return tmessage.CallResponseMessage(args=[b'hello', '', 'world'])


@pytest.mark.gen_test
def test_tornado_client_with_server_not_there(random_open_port):

    with pytest.raises(ConnectionClosedException):
        yield TornadoConnection.outgoing(
            'localhost:%d' % random_open_port,
        )


# TODO test case will fail due to StreamClosedError when
# increase the LARGE_AMOUNT to even bigger
@pytest.mark.gen_test
@pytest.mark.parametrize('arg2, arg3', [
        ("", big_arg()),
        (big_arg(), ""),
        ("test", big_arg()),
        (big_arg(),  "test"),
        (big_arg(), big_arg()),
        ("", ""),
        ("test", "test"),
    ],
    ids=lambda arg: str(len(arg))
)
def test_tchannel_call_request_streaming(tchannel_server, call_response,
                                         arg2, arg3):
    endpoint = b'tchannelpeertest'
    call_response.args[0] = endpoint

    tchannel_server.expect_call(endpoint).and_return(call_response)

    tchannel = TChannel()

    hostport = 'localhost:%d' % (tchannel_server.port)

    response = yield tchannel.request(hostport).send(endpoint, arg2, arg3)

    assert response.args[0] == call_response.args[0]
    assert response.args[2] == call_response.args[2]


@pytest.mark.gen_test
def test_tcurl(server, call_response):
    endpoint = b'tcurltest'
    call_response.args[0] = endpoint

    server.expect_call(endpoint).and_return(call_response)

    hostport = 'localhost:%d/%s' % (
        server.port, endpoint.decode('ascii')
    )
    responses = yield tcurl.main(['--host', hostport, '-d', ''])

    # TODO: get multiple requests working here
    assert len(responses) == 1

    for response in responses:
        assert response.args[0] == call_response.args[0]
        assert response.args[2] == call_response.args[2]


@pytest.mark.gen_test
def test_endpoint_not_found(tchannel_server, call_response):
    endpoint = b'tchanneltest'
    tchannel_server.expect_call(endpoint).and_return(call_response)
    tchannel = TChannel()

    hostport = 'localhost:%d' % (tchannel_server.port)

    response = yield tchannel.request(hostport).send("", "", "")
    assert response.message_type == Types.ERROR
    assert response.code == ErrorCode.bad_request