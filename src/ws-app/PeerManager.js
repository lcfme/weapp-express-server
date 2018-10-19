import { EventEmitter } from 'events';
import UserPeer from './UserPeer';
import GameRoom from './GameRoom';

export class PeerManager extends EventEmitter {
  static EVENT = {
    PEER: Math.random()
      .toString(16)
      .substr(2),
    REQUESTGAME: Math.random()
      .toString(16)
      .substr(2),
    QUIT: Math.random()
      .toString(16)
      .substr(2),
    GAME_OVER: Math.random()
      .toString(16)
      .substr(2)
  };
  peerByUserId: Map<string, UserPeer>;
  waitQueueId: Array<string>;
  repeat: number | void;
  gameRooms: { [k: string]: GameRoom };
  constructor() {
    super();
    this.peerByUserId = new Map();
    this.waitQueueId = [];
    this.gameRooms = {};

    this.on(PeerManager.EVENT.PEER, this.onPeer.bind(this));
    this.on(PeerManager.EVENT.QUIT, this.onQuit.bind(this));
    this.on(PeerManager.EVENT.REQUESTGAME, this.onRequestGame.bind(this));
    this.on(PeerManager.EVENT.GAME_OVER, this.onGameOver.bind(this));
    this.repeat = setInterval(() => {
      this.repeatFunc();
    }, 5000);
  }
  onPeer(userPeer: UserPeer) {
    const _up = this.peerByUserId.get(userPeer.userId);
    if (_up) {
      _up.socket.close();
    }
    this.peerByUserId.set(userPeer.userId, userPeer);
    let i = 0;
    while (i < this.waitQueueId.length) {
      if (this.waitQueueId[i] === userPeer.userId) {
        this.waitQueueId.splice(i, 1);
      }
      i++;
    }
  }
  onRequestGame(userPeer: UserPeer) {
    if (!this.waitQueueId.includes(userPeer.userId)) {
      this.waitQueueId.push(userPeer.userId);
    }
    if (this.waitQueueId.length >= 2) {
      const candidates = this.waitQueueId.splice(0, 2);
      var gr = new GameRoom(
        this,
        ...candidates.map(userId => this.peerByUserId.get(userId))
      );
      this.gameRooms[gr.roomId] = gr;
    }
  }
  onGameOver(gr: GameRoom) {
    delete this.gameRooms[gr.roomId];
  }
  destroy() {
    this.removeAllListeners();
    clearInterval(this.repeat);
    this.peerByUserId.clear();
  }
  onQuit(userPeer: UserPeer) {
    this.peerByUserId.delete(userPeer.userId);
    let i = 0;
    while (i < this.waitQueueId.length) {
      if (this.waitQueueId[i] === userPeer.userId) {
        this.waitQueueId.splice(i, 1);
      }
      i++;
    }
  }
  repeatFunc() {
    console.log('a: ', this.peerByUserId.keys(), 'w: ', this.waitQueueId);
  }
}

const pm = new PeerManager();

export default pm;
