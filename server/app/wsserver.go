package app

import (
	"encoding/binary"
	"fmt"
	"github.com/nothollyhigh/kiss/log"
	"github.com/nothollyhigh/kiss/net"
	"github.com/nothollyhigh/kiss/util"
	"net/http"
)

var (
	wsServer *net.WSServer

	fileSvr http.Handler
)

var (
	handlers = map[uint16]func(client *net.WSClient, data []byte){}
)

func handle(msgId uint16, h func(client *net.WSClient, data []byte)) {
	if _, ok := handlers[msgId]; ok {
		log.Panic("handler exist for msgId: %v", msgId)
	}
	handlers[msgId] = h
}

func onMessage(client *net.WSClient, msg net.IMessage) {
	fmt.Println("onMessage")
	data := msg.Data()
	msgId := binary.BigEndian.Uint16(data[2:4])
	fmt.Println(msgId)
	if h, ok := handlers[msgId]; ok {
		h(client, data[8:])
	} else {
		log.Error("no handler for msgId: %v", msgId)
	}
}

func startWsServer() {
	var err error

	wsServer, err = net.NewWebsocketServer("KISS", config.SvrAddr)
	if err != nil {
		log.Panic("NewWebsocketServer failed: %v", err)
	}

	// 前端静态资源
	fileSvr := http.FileServer(http.Dir("static"))
	wsServer.HandleHttp(fileSvr.ServeHTTP)

	// websocket路由
	wsServer.HandleWs("/plaza/ws")

	// websocket协议号
	// wsServer.Handle(CMD_LOGIN_REQ, onLoginReq)
	handle(CMD_LOGIN_REQ, onLoginReq)
	wsServer.HandleMessage(onMessage)

	util.Go(func() {
		wsServer.Serve()
	})
}
