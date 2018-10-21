import url from 'url';
import UserPeer from './UserPeer';
import pm from './PeerManager';

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
    const userInfo = {
      userId: token,
      nickName,
      avatarUrl
    };
    console.log(userInfo);
    new UserPeer(userInfo, socket, pm);
  } else {
    socket.close();
  }
}
