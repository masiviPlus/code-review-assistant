const API_KEY = "sk-1234567890abcdef";
const DB_PASSWORD = "supersecretpassword123";
const JWT_SECRET = "my-jwt-secret-key-do-not-share";

function connectDB() {
  const uri = "mongodb://admin:" + DB_PASSWORD + "@prod-db.example.com:27017/myapp";
  return mongoose.connect(uri);
}

function callExternalAPI(data) {
  return fetch("https://api.example.com/v1/data", {
    headers: {
      Authorization: "Bearer " + API_KEY,
      "X-API-Secret": "hardcoded-secret-456",
    },
    body: JSON.stringify(data),
  });
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}
