const fs = require("fs");

function readConfig(path) {
  const data = fs.readFileSync(path, "utf-8");
  const config = JSON.parse(data);
  return config;
}

function fetchData(url) {
  return fetch(url).then((res) => res.json());
}

const config = readConfig("./config.json");
console.log(config.database.host);
