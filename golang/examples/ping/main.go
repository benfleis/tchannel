package main

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

import (
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/uber/tchannel/golang"
	"github.com/uber/tchannel/golang/json"
)

var log = tchannel.SimpleLogger

// Ping is the ping request type.
type Ping struct {
	Message string `json:"message"`
}

// Pong is the ping response type.
type Pong Ping

func pingHandler(ctx json.Context, ping *Ping) (*Pong, error) {
	return &Pong{
		Message: fmt.Sprintf("ping %v", ping),
	}, nil
}

func onError(ctx context.Context, err error) {
	log.Fatalf("onError: %v", err)
}

func listenAndHandle(s *tchannel.Channel, hostPort string) {
	log.Infof("Service %s", hostPort)

	// If no error is returned, the listen was successful. Serving happens in the background.
	if err := s.ListenAndServe(hostPort); err != nil {
		log.Fatalf("Could not listen on %s: %v", hostPort, err)
	}
}

func main() {
	// Create a new TChannel for handling requests
	ch, err := tchannel.NewChannel("PingService", &tchannel.ChannelOptions{Logger: tchannel.SimpleLogger})
	if err != nil {
		log.Fatalf("Could not create new channel: %v", err)
	}

	// Register a handler for the ping message on the PingService
	json.Register(ch, json.Handlers{
		"ping": pingHandler,
	}, onError)

	// Listen for incoming requests
	listenAndHandle(ch, "127.0.0.1:10500")

	// Create a new TChannel for sending requests.
	client, err := tchannel.NewChannel("ping-client", nil)
	if err != nil {
		log.Fatalf("Could not create new client channel: %v", err)
	}

	// Make a call to ourselves, with a timeout of 10s
	ctx, cancel := json.NewContext(time.Second * 10)
	defer cancel()

	peer := client.Peers().Add(ch.PeerInfo().HostPort)
	var pong Pong
	if err := json.CallPeer(ctx, peer, "PingService", "ping", &Ping{"Hello World"}, &pong); err != nil {
		log.Fatalf("json.Call failed: %v", err)
	}

	log.Infof("Received pong: %s", pong.Message)
}
