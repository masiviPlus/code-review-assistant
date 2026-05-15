const mysql = require("mysql");
const connection = mysql.createConnection({ host: "localhost", user: "root", database: "app" });

function getUser(userId) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  return new Promise((resolve, reject) => {
    connection.query(query, (err, results) => {
      if (err) reject(err);
      else resolve(results[0]);
    });
  });
}

function searchUsers(name) {
  const query = `SELECT * FROM users WHERE name LIKE '%${name}%'`;
  return new Promise((resolve, reject) => {
    connection.query(query, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

function deleteUser(req) {
  const query = "DELETE FROM users WHERE id = " + req.params.id;
  connection.query(query);
}
