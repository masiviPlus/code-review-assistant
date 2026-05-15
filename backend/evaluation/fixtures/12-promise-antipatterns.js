function getUser(id) {
  return new Promise((resolve, reject) => {
    return fetch("/api/users/" + id)
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        resolve(data);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

async function saveUser(user) {
  const result = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  }).then((res) => res.json());
  return result;
}

async function loadAll(ids) {
  const results = [];
  for (const id of ids) {
    const user = await getUser(id);
    results.push(user);
  }
  return results;
}
