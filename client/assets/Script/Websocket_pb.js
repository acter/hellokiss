var utfx = require("utfx");
var pako = require("pako");
class Websocket{
    // use this for initialization
    init(wsImpl) {
        var self = this;
        
        self.wsImpl = wsImpl;

        self.CmdPing = 0x1 << 24;

        self.SOCK_STATE_CLOSED = 0;
        self.SOCK_STATE_CONNECTING = 1;
        self.SOCK_STATE_CONNECTED = 2;

        self.state = self.SOCK_STATE_CONNECTING;

        try {
            if ('WebSocket' in window) {
                self.ws = new WebSocket(wsImpl.wsUrl);
            } else if ('MozWebSocket' in window) {
                self.ws = new MozWebSocket(wsImpl.wsUrl);
            } else {
                self.ws = new SockJS(wsImpl.wsUrl);
            }

            self.state = self.SOCK_STATE_CONNECTING;


            self.ws.onopen = function (event) {
                self.state = self.SOCK_STATE_CONNECTED;


                if (wsImpl.onWsOpen) {
                    wsImpl.onWsOpen(wsImpl);
                }
            };
            self.ws.onclose = function (event) {
                if (wsImpl.onWsClose) {
                    wsImpl.onWsClose(wsImpl);
                }

                self.ws.close();

                // shutdown
                if (self.state == self.SOCK_STATE_CLOSED) {
                    return;
                }

                self.state = self.SOCK_STATE_CONNECTING;
                
                self.init(wsImpl);
            };
            self.ws.onerror = function (event) {
                if (wsImpl.onWsError) {
                    wsImpl.onWsError(wsImpl);
                }
            };
            self.ws.onmessage = function (event) {
                try {
                    
                    var data;
                    var msg = this.readBuffer(event.data);
                   if (msg.content) {
                        data = JSON.parse(msg.content);
                    }
                    self.onMessage(msg.msgid, data)
                } catch(e) {
                    cc.log("Websocket onmessage panic:", e);
                }
            };
        } catch (e) {
            cc.log("Websocket constructor failed:", e);
        }
    }

    handle(instance, cmd, cb) {
        var self = this;
        if (!self.handlers) {
            self.handlers = {};
        }
        self.handlers[cmd] = {instance: instance, cb: cb};
    }

    onMessage(cmd, data) {
        var self = this;
        if (self.handlers) {
            var handler = self.handlers[cmd];
            if (handler) {
                handler.cb(handler.instance, cmd, data)
            } else {
                cc.log("Plaza no handler for cmd:", cmd);
            }
        }
    }

    sendMsg(cmd, data) {
        var self = this;
        
        if (self.state != self.SOCK_STATE_CONNECTED) {
            cc.log("sendMsg failed: websocket disconnected")
            return
        }

        if (self.ws) {
            var buffer = self.writeBuffer(cmd,data);
            self.ws.send(buffer);
            // cc.log("sendMsg:", buffer)
            // cc.log("sendMsg:", dataArr)
        }
    }


    writeBuffer(msgId,msgBody) {
        var view = null;
        if (msgBody != null) {
            msgBody = JSON.stringify(msgBody);
            var strCodes = this.stringSource(msgBody);
            cc.log(strCodes);
            var length = utfx.calculateUTF16asUTF8(strCodes)[1];
            cc.log("lenght:"+length);
            var buffer = new ArrayBuffer(length + 8); // 初始化长度为UTF8编码后字符串长度+8个Byte的二进制缓冲区
            view = new DataView(buffer);
            var offset = 8;
            view.setInt8(0, 192); // 将长度放置在字符串的头部
            view.setInt8(1, 128);//从第1个Byte位置开始 放置一个数字为128的Short类型数据(占6 Byte)
            view.setInt16(2, msgId);//从第2个Byte位置开始放置一个数字为1000的Short类型数据(占8 Byte)
            view.setUint32(4, length);
            utfx.encodeUTF16toUTF8(this.stringSource(msgBody), function (b) {
                view.setUint8(offset++, b);
            }.bind(this));
        }
        else {
            // cc.log("msg body no0------ping");
            var buffer = new ArrayBuffer(8);
            view = new DataView(buffer);
            view.setInt8(0, 192); // 将长度放置在字符串的头部
            view.setInt8(1, 128);
            view.setInt16(2, msgId);
        }
        return view.buffer;
    }
    /**
     * 读取内容
     */
    readBuffer(buffer) {
        var view = new DataView(buffer);
        var strlength = (view.getInt8(0),view.getInt8(1));
        // view.getInt8(1);
        var offset = 8;
        var msgid = view.getInt16(2);//msgid
        // cc.log("msgid:"+msgid);
        var _bodyLen = view.getUint32(4);
        // cc.log(strlength);
        // cc.log("strlength---------");
        if (64 & strlength) {
            buffer = buffer.slice(8, buffer.byteLength);
            buffer = pako.inflate(buffer).buffer;
            view = new DataView(buffer);
            offset = 0;
            _bodyLen = buffer.byteLength;
        }
        var strResult = null;
        if (_bodyLen != 0) {
            var result = []; // Unicode编码字符
            var end=  _bodyLen + offset;
            utfx.decodeUTF8toUTF16(function () {
                return offset < end ? view.getUint8(offset++) : null; // 返回null时会退出此转换函数
            }.bind(this), (char) => {
                // console.log(char)
                result.push(char);
            });
            
            strResult = result.reduce((prev, next)=>{
                return prev + String.fromCharCode(next);
            }, '');
        }
        return {
            msgid: msgid,
            content: strResult
        }
    }
    stringSource(s) {
        let i = 0;
        return function () {
            return i < s.length ? s.charCodeAt(i++) : null;
        };
    }
    stringSource(s) {
        let i = 0;
        return function () {
            return i < s.length ? s.charCodeAt(i++) : null;
        };
    }


    shutdown() {
        self.ws.close();
        self.state = self.SOCK_STATE_CLOSED;
    }
}

module.exports = Websocket;
