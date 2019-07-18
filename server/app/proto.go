package app

import (
	"encoding/binary"
	// "fmt"
	"github.com/nothollyhigh/kiss/net"
)

const (
	CMD_LOGIN_REQ        uint16 = 1 // 登录请求
	CMD_LOGIN_RSP        uint16 = 2 // 登录响应
	CMD_PING_REQ         uint16 = 1000
	CMD_PING_RSP         uint16 = 1200
	CMD_BROADCAST_NOTIFY uint16 = 3 // 广播通知
)

type LoginReq struct {
}

// type LoginRsp struct {
// 	Code int    `json:"code"`
// 	Msg  string `json:"msg"`
// 	Name string `json:"name"`
// }

type LoginRsp struct {
	MsgId   int `json:"msgid"`
	Content struct {
		ServerTime int `json:serverTime`
	}
}

type KickNotify struct {
	Msg string `json:"msg"`
}

type BroadcastNotify struct {
	Msg string `json:"msg"`
}

func NewMessage(cmd uint16, v interface{}) *net.Message {
	data, ok := v.([]byte)
	if !ok {
		data, _ = json.Marshal(v)
	}
	//客户端
	//
	// {
	// 	"msgid": 1201,
	// 	"content": {
	// 		"serverTime":1563317708411
	// 	}
	// }
	mdata := make([]byte, len(data)+8)
	mdata[0] = 192
	mdata[1] = 128
	binary.BigEndian.PutUint16(mdata[2:4], uint16(cmd))
	if len(data) > 0 {
		mdata[7] = 118 //118 = len(data)
		// view.setUint32(4, length);
		// binary.BigEndian.PutUint32(mdata[5:7], 118)
		copy(mdata[8:], data)
	}
	return net.RawMessage(mdata)
}
