import WebSocket from 'ws';
import { PeerManager } from './PeerManager';
import GameRoom from './GameRoom';

type UserInfo = {
  userId: string,
  nickName: string,
  avatarUrl: string
};

type EthInfo = {
  account: string,
  password: string,
}

class UserPeer {
  userId: string;
  socket: WebSocket;
  pm: PeerManager;
  gameRoom: GameRoom | null;
  ethInfo: EthInfo;
  active: boolean;
  constructor(
    { userId, nickName, avatarUrl }: UserInfo,
    ethInfo: EthInfo = {},
    socket: WebSocket,
    pm: PeerManager
  ) {
    if (
      typeof userId !== 'string' ||
      typeof nickName !== 'string' ||
      typeof avatarUrl !== 'string'
    ) {
      throw new Error('Invalid Call');
    }
    this.userId = String(userId);
    this.avatarUrl = String(avatarUrl);
    this.nickName = String(nickName);
    this.socket = socket;
    this.pm = pm;
    this.gameRoom = null;
    this.ethInfo = ethInfo;
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
