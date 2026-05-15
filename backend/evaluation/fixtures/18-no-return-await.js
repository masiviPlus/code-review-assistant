async function getUser(id) {
  return await fetch("/api/users/" + id).then((r) => r.json());
}

async function saveData(data) {
  return await db.collection("data").insertOne(data);
}

async function deleteItem(id) {
  return await db.collection("items").deleteOne({ _id: id });
}

async function fetchWithRetry(url, attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
  }
}
