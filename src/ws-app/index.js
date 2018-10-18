import url from 'url';
import UserPeer from './UserPeer';
import pm from './PeerManager';

export function onConnection(socket, req) {
  const urlObject = url.parse(req.url, true);
  if (urlObject && urlObject.query && urlObject.query.token) {
    const token = urlObject.query.token;
    new UserPeer(token, socket, pm);
  }
}
