import url from 'url';
import UserPeer from './UserPeer';
import pm from './PeerManager';
import chalk from 'chalk';
import web3 from '../web3';

export function onConnection(socket, req) {
  const urlObject = url.parse(req.url, true);
  if (
    urlObject &&
    urlObject.query &&
    urlObject.query.token &&
    urlObject.query.nickName &&
    urlObject.query.avatarUrl
  ) {
    const token = urlObject.query.token;
    const nickName = decodeURIComponent(urlObject.query.nickName);
    const avatarUrl = decodeURIComponent(urlObject.query.avatarUrl);
    const ethAccount = urlObject.query.ethAccount
      ? decodeURIComponent(urlObject.query.ethAccount)
      : undefined;
    const ethPass = urlObject.query.ethPass
      ? decodeURIComponent(urlObject.query.ethPass)
      : undefined;

    const userInfo = {
      userId: token,
      nickName,
      avatarUrl
    };
    debugger;
    if (!ethAccount || !ethPass) {
      const password = Math.random()
        .toString(16)
        .substr(2);
      let __tempLock = false;
      web3.personal.newAccount(password, (err, result) => {
        debugger;
        if (__tempLock) {
          return;
        }
        __tempLock = true;
        if (err || !result) {
          new UserPeer(userInfo, {}, socket, pm);
          return;
        }
        const ethInfo = {
          password,
          account: result
        };
        var account = web3.eth.accounts[0];
        const orgpass = 'yushuilai';
        var amount = web3.toWei(10, 'ether');
        try {
          web3.personal.unlockAccount(account, orgpass, 100);
          web3.eth.sendTransaction({
            from: account,
            to: result,
            value: amount
          });
        } catch (e) {
          console.log(e);
          return;
        }
        socket.send(
          JSON.stringify({
            cmd: 'set_ethinfo',
            ethInfo
          })
        );
        new UserPeer(userInfo, ethInfo, socket, pm);
      });
      setTimeout(() => {
        if (__tempLock) return;
        __tempLock = true;
        new UserPeer(userInfo, {}, socket, pm);
      }, 5000);
    } else {
      const ethInfo = {
        account: ethAccount,
        password: ethPass
      };
      new UserPeer(userInfo, ethInfo, socket, pm);
    }
  } else {
    socket.close();
  }
}
