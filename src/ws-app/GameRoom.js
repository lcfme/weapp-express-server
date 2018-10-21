import UserPeer from './UserPeer';
import { PeerManager } from './PeerManager';
import examDB from '../exam-database';
import uuid from 'uuid/v4';
import request from 'request';

class GameRoom {
  static STATE = {
    PREPARE: Math.random()
      .toString(16)
      .substr(2),
    START: Math.random()
      .toString(16)
      .substr(2),
    FINISH: Math.random()
      .toString(16)
      .substr(2)
  };
  static CONST = {
    PEER_QUIT: Math.random()
      .toString(16)
      .substr(2),
    NORMAL_OVER: Math.random().toString
  };
  pm: PeerManager;
  users: Array<UserPeer>;
  repeat: number;
  roomId: string;
  questions: Array<any>;
  removeUserSocketListener: Array<Function>;
  currentState: string;
  upwrapArray: Array<UserPeerWraperForGameRoom>;
  lockForSubmitAnswer: boolean;
  __forClearTimeout: number;
  constructor(pm: PeerManager, ...users: Array<UserPeer>) {
    this.pm = pm;
    this.users = users.slice(0, 2);
    this.upwrapArray = this.users.map(
      up => new UserPeerWraperForGameRoom(up, this)
    );
    this.repeat = 0;
    this.lockForSubmitAnswer = false;
    this.roomId = uuid();
    if (this.users.length !== 2) {
      throw new Error('Invalid User Count');
    }

    request(
      'http://live.trunk.koo.cn/api/1024/question_list',
      (error, response, body) => {
        try {
          if (error) {
            throw error;
          }
          const { code, data } = JSON.parse(body);
          if (code !== 0 || !Array.isArray(data)) {
            throw new Error('data is not array');
          }
          this.questions = data.map((item, index) => {
            return {
              ...item,
              index
            };
          });

          this.callUsersMethod('startGame', this);
          this.currentState = GameRoom.STATE.PREPARE;
          this.currentQuestionIndex = 0;
          this.__forClearTimeout = 0;

          for (let i = this.users.length; i--; ) {
            const user = this.users[i];
            user.sendJSON({
              cmd: 'game_room_created',
              roomId: this.roomId,
              others: this.users
                .filter(up => up.userId !== user.userId)
                .map(up => ({
                  userId: up.userId,
                  avatarUrl: up.avatarUrl,
                  nickName: up.nickName
                }))
            });
          }
        } catch (err) {
          this.broadCast({
            cmd: 'server_error'
          });
          return;
        }
      }
    );

    /**
     * 处理试题
     */

    // this.questions = examDB().map((item, index) => {
    //   return {
    //     ...item,
    //     index
    //   };
    // });

    /**
     * 处理socket终端断开
     */
    this.removeUserSocketListener = [];
    for (let i = this.upwrapArray.length; i--; ) {
      this.removeUserSocketListener.push(
        this.setUserSocket(this.upwrapArray[i])
      );
    }
    this.interval();
  }

  setUserSocket(upwrap: UserPeerWraperForGameRoom) {
    const up = upwrap.userpeer;
    const close = e => {
      this.onPeerQuit(upwrap);
    };
    const message = data => {
      try {
        const msgObject = JSON.parse(data);
        switch (msgObject.cmd) {
          case 'player_ready':
            upwrap.ready = true;
            let flag = true;
            for (let i = this.upwrapArray.length; i--; ) {
              if (!this.upwrapArray[i].ready) {
                flag = false;
                break;
              }
            }
            if (flag) {
              this.startGame();
            }
            break;
          case 'answer_question':
            if (upwrap.answeredCurrentQuestion) {
              break;
            }
            upwrap.answeredCurrentQuestion = true;

            const answer = msgObject.answer;
            const qIndex = isNaN(msgObject.index)
              ? this.currentQuestionIndex
              : msgObject.index;
            const question = this.questions[qIndex];
            const isRight = this.lockForSubmitAnswer
              ? false
              : answer === question.answer;

            if (isRight && qIndex === this.currentQuestionIndex) {
              this.broadCast({
                cmd: 'broadcast_result',
                userId: upwrap.userpeer.userId
              });
              upwrap.answers[qIndex] = {
                answer,
                right: isRight
              };
              this.lockForSubmitAnswer = true;
              this.currentQuestionIndex += 1;
              this.startSequence();
            } else if (!isRight && qIndex === this.currentQuestionIndex) {
              upwrap.answers[qIndex] = {
                answer,
                right: isRight
              };
            }

            break;
          case 'player_quit':
            this.onPeerQuit(upwrap);
            break;
          default:
            throw 'No Matched COMMAND';
        }
      } catch (err) {
        console.error(err);
      }
    };
    up.socket.on('close', close);
    up.socket.on('message', message);
    return () => {
      up.socket.removeListener('close', close);
      up.socket.removeListener('message', message);
    };
  }

  startGame() {
    this.broadCast({
      cmd: 'game_start'
    });
    this.currentState = GameRoom.STATE.START;
    setTimeout(() => {
      this.startSequence();
    }, 3000);
  }
  startSequence() {
    clearTimeout(this.__forClearTimeout);
    this.lockForSubmitAnswer = false;
    for (let i = this.upwrapArray.length; i--; ) {
      const upwrap = this.upwrapArray[i];
      upwrap.answeredCurrentQuestion = false;
    }
    if (this.currentQuestionIndex >= this.questions.length) {
      this.finishGame(GameRoom.CONST.NORMAL_OVER);
    }
    if (this.currentState !== GameRoom.STATE.START) {
      return;
    }
    const question = this.questions[this.currentQuestionIndex];
    this.broadCast({
      cmd: 'next_question',
      index: this.currentQuestionIndex,
      question
    });

    this.__forClearTimeout = setTimeout(() => {
      this.currentQuestionIndex += 1;
      if (this.currentQuestionIndex < this.questions.length) {
        this.startSequence();
      } else {
        this.finishGame(GameRoom.CONST.NORMAL_OVER);
      }
    }, 5000);
  }
  callUsersMethod(methodName, ...args) {
    for (let i = this.users.length; i--; ) {
      this.users[i][methodName](...args);
    }
  }
  onPeerQuit(upwrap: UserPeerWraperForGameRoom) {
    upwrap.abort = true;
    this.broadCast({
      cmd: 'peer_quit',
      userId: upwrap.userpeer.userId
    });
    this.finishGame(GameRoom.CONST.PEER_QUIT);
  }
  broadCast(msg) {
    if (typeof msg === 'undefined') return;
    for (let i = this.users.length; i--; ) {
      this.users[i].sendJSON(msg);
    }
  }

  interval() {
    clearInterval(this.repeat);
    this.repeat = setInterval(() => {}, 5000);
  }
  finishGame(excpt: string) {
    if (this.currentState === GameRoom.STATE.FINISH) {
      return;
    }
    if (this.currentState === GameRoom.STATE.START) {
      if (excpt === GameRoom.CONST.NORMAL_OVER) {
        let winer: UserPeerWraperForGameRoom | void;
        for (let i = this.upwrapArray.length; i--; ) {
          let upwrap = this.upwrapArray[i];
          if (!winer) winer = upwrap;
          if (
            upwrap.getRightQuestionNumber() > winer.getRightQuestionNumber()
          ) {
            winer = upwrap;
          }
        }
        this.broadCast({
          cmd: 'game_winer',
          userId: winer.userpeer.userId,
          avatarUrl: winer.userpeer.avatarUrl,
          nickName: winer.userpeer.nickName,
          right: winer.getRightQuestionNumber()
        });
        for (let i = this.users.length; i--; ) {
          const up = this.users[i];
          if (up.userId === winer.userpeer.userId) {
            console.log('save result');
            request(
              `http://live.trunk.koo.cn/api/1024/save_match_result?uuid=${
                up.userId
              }&avatarUrl=${encodeURIComponent(
                up.avatarUrl
              )}&nickName=${encodeURIComponent(up.nickName)}&smallRoomId=${
                this.roomId
              }&score=${this.upwrapArray[i].getRightQuestionNumber()}&bonus=100`
            );
            continue;
          } else {
            console.log('save result');
            request(
              `http://live.trunk.koo.cn/api/1024/save_match_result?uuid=${
                up.userId
              }&avatarUrl=${encodeURIComponent(
                up.avatarUrl
              )}&nickName=${encodeURIComponent(up.nickName)}&smallRoomId=${
                this.roomId
              }&score=${this.upwrapArray[i].getRightQuestionNumber()}&bonus=0`
            );
          }
        }
      } else if (excpt === GameRoom.CONST.PEER_QUIT) {
        let winer: UserPeerWraperForGameRoom | void;
        for (let i = this.upwrapArray.length; i--; ) {
          const upwrap = this.upwrapArray[i];
          if (!upwrap.abort) {
            winer = upwrap;
            winer.userpeer.sendJSON({
              cmd: 'game_winer',
              userId: winer.userpeer.userId,
              avatarUrl: winer.userpeer.avatarUrl,
              nickName: winer.userpeer.nickName,
              right: winer.getRightQuestionNumber()
            });
          }
        }
        for (let i = this.users.length; i--; ) {
          const up = this.users[i];
          if (up.userId === winer.userpeer.userId) {
            console.log('save result');
            request(
              `http://live.trunk.koo.cn/api/1024/save_match_result?uuid=${
                up.userId
              }&avatarUrl=${encodeURIComponent(
                up.avatarUrl
              )}&nickName=${encodeURIComponent(up.nickName)}&smallRoomId=${
                this.roomId
              }&score=${this.upwrapArray[i].getRightQuestionNumber()}&bonus=100`
            );
            continue;
          } else {
            console.log('save result');
            request(
              `http://live.trunk.koo.cn/api/1024/save_match_result?uuid=${
                up.userId
              }&avatarUrl=${encodeURIComponent(
                up.avatarUrl
              )}&nickName=${encodeURIComponent(up.nickName)}&smallRoomId=${
                this.roomId
              }&score=${this.upwrapArray[i].getRightQuestionNumber()}&bonus=0`
            );
          }
        }
      }
    }
    this.pm.emit(PeerManager.EVENT.GAME_OVER, this);
    // 清楚socket绑定事件
    for (let i = this.removeUserSocketListener.length; i--; ) {
      this.removeUserSocketListener[i]();
    }
    this.broadCast({
      cmd: 'game_over'
    });
    this.callUsersMethod('finishGame');
    this.currentState = GameRoom.STATE.FINISH;
  }
}

class UserPeerWraperForGameRoom {
  ready: boolean;
  answers: Array<{ answer: string, right: boolean } | void>;
  userpeer: UserPeer;
  gameRoom: GameRoom;
  answeredCurrentQuestion: boolean;
  abort: boolean;
  __right_number__: number | void;
  constructor(up: UserPeer, gr: GameRoom) {
    this.ready = false;
    this.userpeer = up;
    this.answers = [];
    this.gameRoom = gr;
    this.abort = false;
    this.answeredCurrentQuestion = false;
  }
  getRightQuestionNumber(force: boolean): number {
    if (this.__right_number__ && !force) {
      return this.__right_number__;
    }
    const length = this.gameRoom.questions.length;
    let count = 0;
    for (let i = 0; i < length; i++) {
      if (this.answers[i] && this.answers[i].right) {
        count++;
      }
    }
    this.__right_number__ = count;
    return count;
  }
}

export default GameRoom;
