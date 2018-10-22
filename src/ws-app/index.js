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
    if (!ethAccount || !ethPass) {
      const password = Math.random()
        .toString(16)
        .substr(2);
      web3.personal.newAccount(password, (err, result) => {
        console.log(err, result);
        if (err) {
          new UserPeer(userInfo, {}, socket, pm);
          return;
        }
        const ethInfo = {
          password,
          account: result
        };
        web3.eth.sendTransaction({
          from: web3.eth.accounts[0],
          password: 'yushuilai',
          to: result,
          value: web3.toWei(1, 'ether')
        });
        socket.send(
          JSON.stringify({
            cmd: 'set_ethinfo',
            ethInfo
          })
        );
        new UserPeer(userInfo, ethInfo, socket, pm);
      });
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
