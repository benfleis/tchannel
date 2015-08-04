// Autogenerated by thrift-gen. Do not modify.
package stream

import (
	"fmt"

	athrift "github.com/apache/thrift/lib/go/thrift"
	"github.com/uber/tchannel/golang/thrift"
)

// Interfaces for the service and client for the services defined in the IDL.

type TChanUniqC interface {
}

// Implementation of a client and service handler.

type tchanUniqCClient struct {
	client thrift.TChanClient
}

func NewTChanUniqCClient(client thrift.TChanClient) TChanUniqC {
	return &tchanUniqCClient{client: client}
}

type tchanUniqCServer struct {
	handler TChanUniqC
}

func NewTChanUniqCServer(handler TChanUniqC) thrift.TChanServer {
	return &tchanUniqCServer{handler}
}

func (s *tchanUniqCServer) Service() string {
	return "UniqC"
}

func (s *tchanUniqCServer) Methods() []string {
	return []string{}
}

func (s *tchanUniqCServer) Handle(ctx thrift.Context, methodName string, protocol athrift.TProtocol) (bool, athrift.TStruct, error) {
	switch methodName {
	default:
		return false, nil, fmt.Errorf("method %v not found in service %v", methodName, s.Service())
	}
}
