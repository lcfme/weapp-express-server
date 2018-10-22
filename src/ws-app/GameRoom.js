import UserPeer from './UserPeer';
import { PeerManager } from './PeerManager';
import examDB from '../exam-database';
import uuid from 'uuid/v4';
import request from 'request';
import web3 from '../web3';

type Question = {
  answer: number,
  content: string,
  options: Array<string>
};

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
  questions: Array<Question>;
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

  publishContract(
    p1: string,
    p2: string,
    question: string,
    answer: string,
    callback: Function
  ): void {
    ///< Publish account
    var account = web3.eth.accounts[0];
    const password = 'yushuilai';

    ///<player account
    //var p1 = web3.eth.accounts[1];//"0x8363330600bfb9a2a3926149be35bffdae5a6600";
    //var p2 = web3.eth.accounts[2];//"0x70fb6ea628abe149aa30eb993a1d34c14bb2dd7c";
    var cQuestion = question;
    // var answer = "A";

    console.log(account);

    ///< unlock account
    try {
      web3.personal.unlockAccount(account, password, 100);
    } catch (e) {
      console.log('publishContract error in unlockAccount');
      callback(new Error('Oops'));
      return;
    }

    ///< Contract ABI
    var abi = [
      {
        constant: false,
        inputs: [
          {
            name: 'p1',
            type: 'address'
          },
          {
            name: 'p2',
            type: 'address'
          },
          {
            name: 'cQuestion',
            type: 'string'
          },
          {
            name: 'answer',
            type: 'string'
          }
        ],
        name: 'reset',
        outputs: [
          {
            name: '',
            type: 'bool'
          }
        ],
        payable: true,
        stateMutability: 'payable',
        type: 'function'
      },
      {
        constant: false,
        inputs: [
          {
            name: 'answer',
            type: 'string'
          }
        ],
        name: 'confirm',
        outputs: [
          {
            name: '',
            type: 'bool'
          }
        ],
        payable: true,
        stateMutability: 'payable',
        type: 'function'
      },
      {
        inputs: [
          {
            name: 'p1',
            type: 'address'
          },
          {
            name: 'p2',
            type: 'address'
          },
          {
            name: 'cQuestion',
            type: 'string'
          },
          {
            name: 'answer',
            type: 'string'
          }
        ],
        payable: true,
        stateMutability: 'payable',
        type: 'constructor'
      },
      {
        payable: true,
        stateMutability: 'payable',
        type: 'fallback'
      }
    ];

    var gamecontractContract = web3.eth.contract(abi);
    var amount = web3.toWei(1, 'ether');

    ///< Publish contract
    var gamecontractContract = web3.eth.contract(abi);
    var gamecontract = gamecontractContract.new(
      p1,
      p2,
      cQuestion,
      answer,
      {
        from: account,
        data:
          '0x60806040526002600055604051610a79380380610a7983398101604090815281516020808401519284015160608501516001805460a060020a60ff0219600160a060020a03199091163317167401000000000000000000000000000000000000000017905590850180519395909391019161007f9160029185019061025d565b50805161009390600390602084019061025d565b5060408051608081018252600160a060020a0386811682528251602080820185526000808352818501928352948401859052600160608501529380526004845282517f17ef568e3e12ab5b9c7254a8d58478811de00f9e6eb34345acd53bf8fd09d3ec8054600160a060020a031916919093161782555180519293919261013d927f17ef568e3e12ab5b9c7254a8d58478811de00f9e6eb34345acd53bf8fd09d3ed92019061025d565b506040828101516002909201805460609485015115156101000261ff001994151560ff199092169190911793909316929092179091558051608081018252600160a060020a03808716825282516020818101855260008083528185019283529484018590526001958401869052949093526004845281517fabd6e7cb50984ff9c2f3e18a2660c3353dadf4e3291deeb275dae2cd1e44fe05805491909216600160a060020a031990911617815591518051919361021f927fabd6e7cb50984ff9c2f3e18a2660c3353dadf4e3291deeb275dae2cd1e44fe06929091019061025d565b5060408201516002909101805460609093015115156101000261ff001992151560ff199094169390931791909116919091179055506102f892505050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061029e57805160ff19168380011785556102cb565b828001600101855582156102cb579182015b828111156102cb5782518255916020019190600101906102b0565b506102d79291506102db565b5090565b6102f591905b808211156102d757600081556001016102e1565b90565b610772806103076000396000f30060806040526004361061004b5763ffffffff7c01000000000000000000000000000000000000000000000000000000006000350416631a009847811461004d578063c7ab74a41461010e575b005b604080516020600460443581810135601f81018490048402850184019095528484526100fa94823573ffffffffffffffffffffffffffffffffffffffff9081169560248035909216953695946064949293019190819084018382808284375050604080516020601f89358b018035918201839004830284018301909452808352979a99988101979196509182019450925082915084018382808284375094975061015a9650505050505050565b604080519115158252519081900360200190f35b6040805160206004803580820135601f81018490048402850184019095528484526100fa9436949293602493928401919081908401838280828437509497506103f89650505050505050565b60015460009073ffffffffffffffffffffffffffffffffffffffff163314610184575060006103f0565b6001805474ff00000000000000000000000000000000000000001973ffffffffffffffffffffffffffffffffffffffff199091163317167401000000000000000000000000000000000000000017905582516101e79060029060208601906106ab565b5081516101fb9060039060208501906106ab565b506040805160808101825273ffffffffffffffffffffffffffffffffffffffff87811682528251602080820185526000808352818501928352948401859052600160608501529380526004845282517f17ef568e3e12ab5b9c7254a8d58478811de00f9e6eb34345acd53bf8fd09d3ec805473ffffffffffffffffffffffffffffffffffffffff191691909316178255518051929391926102bf927f17ef568e3e12ab5b9c7254a8d58478811de00f9e6eb34345acd53bf8fd09d3ed9201906106ab565b506040828101516002909201805460609485015115156101000261ff001994151560ff19909216919091179390931692909217909155805160808101825273ffffffffffffffffffffffffffffffffffffffff808816825282516020818101855260008083528185019283529484018590526001958401869052949093526004845281517fabd6e7cb50984ff9c2f3e18a2660c3353dadf4e3291deeb275dae2cd1e44fe0580549190921673ffffffffffffffffffffffffffffffffffffffff199091161781559151805191936103bb927fabd6e7cb50984ff9c2f3e18a2660c3353dadf4e3291deeb275dae2cd1e44fe0692909101906106ab565b5060408201516002909101805460609093015115156101000261ff001992151560ff1990941693909317919091169190911790555b949350505050565b600080548190610407336104b6565b9150811061041857600091506104b0565b6104218161050d565b1561042f57600091506104b0565b6000818152600460205260409020600201805461ff00191690556104528361056d565b156104ab576040513390600090670de0b6b3a76400009082818181858883f19350505050158015610487573d6000803e3d6000fd5b506000818152600460205260409020600201805461ff0019169055600191506104b0565b600091505b50919050565b6000805b6000548110156105035760008181526004602052604090205473ffffffffffffffffffffffffffffffffffffffff848116911614156104fb578091506104b0565b6001016104ba565b5050600054919050565b60015460009074010000000000000000000000000000000000000000900460ff16151561053c57506001610568565b600082815260046020526040902060020154610100900460ff16151561056457506001610568565b5060005b919050565b60035481516000918291600260001961010060018516150201909216919091041461059b57600091506104b0565b5060005b82518110156106a2576003805482906002600019610100600184161502019091160481106105c957fe5b8154600116156105e85790600052602060002090602091828204019190065b9054901a7f0100000000000000000000000000000000000000000000000000000000000000027effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916838281518110151561063e57fe5b6020910101517f010000000000000000000000000000000000000000000000000000000000000090819004027fff00000000000000000000000000000000000000000000000000000000000000161461069a57600091506104b0565b60010161059f565b50600192915050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106106ec57805160ff1916838001178555610719565b82800160010185558215610719579182015b828111156107195782518255916020019190600101906106fe565b50610725929150610729565b5090565b61074391905b80821115610725576000815560010161072f565b905600a165627a7a723058204831c786ddd585908877e3ce7e272339bbe6910bdeb0adfe93f49781cd83f7480029',
        gas: '4700000',
        value: amount
      },
      function(e, contract) {
        //console.log(e, contract);
        if (typeof contract.address !== 'undefined') {
          console.log(
            'Contract mined! address: ' +
              contract.address +
              ' transactionHash: ' +
              contract.transactionHash
          );
          callback(null, contract.address);
          return;
        }
      }
    );
  }

  confirmContract(
    player: string,
    password: string,
    address: string,
    answer: string
  ) {
    ///< http://localhost:8545--get

    var account = player; //web3.eth.accounts[2];//"0x8507c5c18135b5daf275588718b443ab18a0e6a8";		///<Player
    //console.log('account : ' + account)
    //var password = "test00002";
    //var address = "0x6effb1c437c9df9dd0d576e0f94d713095ea5612";
    // var answer = "A";
    web3.eth.defaultAccount = account;

    console.log('confirmContract address: ' + address + ' answer: ' + answer);

    ///<Unlock account
    try {
      web3.personal.unlockAccount(account, password, 100);
    } catch (e) {
      console.log('confirmContract cunlockAccount error');
      return;
    }

    ///<Contract ABI
    var abi = [
      {
        constant: false,
        inputs: [
          {
            name: 'p1',
            type: 'address'
          },
          {
            name: 'p2',
            type: 'address'
          },
          {
            name: 'cQuestion',
            type: 'string'
          },
          {
            name: 'answer',
            type: 'string'
          }
        ],
        name: 'reset',
        outputs: [
          {
            name: '',
            type: 'bool'
          }
        ],
        payable: true,
        stateMutability: 'payable',
        type: 'function'
      },
      {
        constant: false,
        inputs: [
          {
            name: 'answer',
            type: 'string'
          }
        ],
        name: 'confirm',
        outputs: [
          {
            name: '',
            type: 'bool'
          }
        ],
        payable: true,
        stateMutability: 'payable',
        type: 'function'
      },
      {
        inputs: [
          {
            name: 'p1',
            type: 'address'
          },
          {
            name: 'p2',
            type: 'address'
          },
          {
            name: 'cQuestion',
            type: 'string'
          },
          {
            name: 'answer',
            type: 'string'
          }
        ],
        payable: true,
        stateMutability: 'payable',
        type: 'constructor'
      },
      {
        payable: true,
        stateMutability: 'payable',
        type: 'fallback'
      }
    ];

    var contract = web3.eth.contract(abi).at(address);
    contract.confirm(answer);
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
            debugger;
            upwrap.answeredCurrentQuestion = true;

            const answer = msgObject.answer;
            const qIndex = isNaN(msgObject.index)
              ? this.currentQuestionIndex
              : msgObject.index;
            const question = this.questions[qIndex];
            const isRight = this.lockForSubmitAnswer
              ? false
              : answer === question.answer;

            ///< ethereum
            var player = up.ethInfo.account;
            var password = up.ethInfo.password;

            if (player && password && this.address) {
              try {
                this.confirmContract(
                  player,
                  password,
                  this.address,
                  String(answer)
                );
              } catch (err) {
                console.log(err);
              }
            }

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

    ///< ethereum  test
    // if(this.currentQuestionIndex > 0){
    //   var player = web3.eth.accounts[1];
    //   var password = "test0001";
    //   this.confirmContract(player, password, this.address, "A");
    // }

    ///< ethereum publish contract
    var player1 = this.users[0].ethInfo.account;
    var player2 = this.users[1].ethInfo.account;
    var pubQuestion = question.content + question.option;

    console.log('Before publishContract index = ' + this.currentQuestionIndex);

    const _foo = () => {
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
    };

    if (player1 && player2) {
      this.publishContract(
        player1,
        player2,
        pubQuestion,
        String(question.answer),
        (err, address) => {
          this.address = address;
          _foo();
        }
      );
    } else {
      _foo();
    }
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
        this.reportResult(winer);
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
        this.reportResult(winer);
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
  reportResult(winer: UserPeerWraperForGameRoom) {
    for (let i = this.users.length; i--; ) {
      const up = this.users[i];
      let bouns = up.userId === winer.userpeer.userId ? 100 : 0;
      request(
        `http://live.trunk.koo.cn/api/1024/save_match_result?uuid=${
          up.userId
        }&smallRoomId=${this.roomId}&score=${this.upwrapArray[
          i
        ].getRightQuestionNumber()}&bonus=${bouns}`,
        (err, res, body) => {
          console.log(err, body);
        }
      );
    }
  }
}

class UserPeerWraperForGameRoom {
  ready: boolean;
  answers: Array<{
    answer: string,
    right: boolean
  } | void>;
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
