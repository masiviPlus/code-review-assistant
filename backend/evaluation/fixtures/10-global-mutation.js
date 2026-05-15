let currentUser = null;
let requestCount = 0;
let cache = {};

function handleLogin(username, password) {
  currentUser = { username, loggedInAt: Date.now() };
  requestCount++;
  cache = {};
  return currentUser;
}

function handleRequest(path) {
  requestCount++;
  if (cache[path]) {
    return cache[path];
  }
  const result = { path, user: currentUser, time: Date.now() };
  cache[path] = result;
  return result;
}

function resetState() {
  currentUser = null;
  requestCount = 0;
  cache = {};
}
