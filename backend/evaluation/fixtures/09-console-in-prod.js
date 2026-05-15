const express = require("express");
const app = express();

app.use((req, res, next) => {
  console.log("Request: " + req.method + " " + req.url);
  console.log("Headers:", JSON.stringify(req.headers));
  console.log("Body:", req.body);
  next();
});

app.get("/users/:id", async (req, res) => {
  console.log("Fetching user " + req.params.id);
  try {
    const user = await getUser(req.params.id);
    console.log("Found user:", user);
    res.json(user);
  } catch (err) {
    console.error("Error:", err);
    console.log("Stack:", err.stack);
    res.status(500).json({ error: "Internal error" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
