import WebSocket from 'ws';
import { PeerManager } from './PeerManager';
import GameRoom from './GameRoom';

class UserPeer {
  userId: string;
  socket: WebSocket;
  pm: PeerManager;
  gameRoom: GameRoom | null;
  active: boolean;
  constructor(userId: string, socket: WebSocket, pm: PeerManager) {
    if (typeof userId !== 'string' || !socket) {
      console.error(arguments.callee, userId, socket);
      throw new Error('Invalid Call');
    }
    this.userId = String(userId);
    this.socket = socket;
    this.pm = pm;
    this.gameRoom = null;
    this._loop = 0;
    this.active = true;
    socket.on('message', data => {
      console.log(data);
      try {
        const msgObject = JSON.parse(data);
        switch (msgObject.cmd) {
          case 'req_play':
            this.onRequestGame();
            break;
          default:
            throw 'No Matched Command';
        }
      } catch (err) {
        console.error(err);
      }
    });
    socket.on('close', e => {
      this.destroy();
    });
    socket.on('error', err => {
      console.error(err);
      this.destroy();
    });
    this.startLoop();

    pm.emit(PeerManager.EVENT.PEER, this);
  }
  onRequestGame() {
    this.pm.emit(PeerManager.EVENT.REQUESTGAME, this);
  }
  startLoop() {
    clearInterval(this._loop);
    this._loop = setInterval(() => {
      this.sendJSON({
        cmd: 'hb'
      });
    }, 1000);
  }
  destroy() {
    clearInterval(this._loop);
    this.active = false;
    this.pm.emit(PeerManager.EVENT.QUIT, this);
    this.socket.removeAllListeners();
  }
  startGame(gr: GameRoom) {
    this.gameRoom = gr;
  }
  finishGame() {
    this.gameRoom = null;
  }
  sendJSON(o: any) {
    try {
      this.socket.send(JSON.stringify(o));
    } catch (err) {
      console.error(err);
      this.destroy();
    }
  }
}

export default UserPeer;
