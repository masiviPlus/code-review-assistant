function removeInactive(users) {
  for (let i = 0; i < users.length; i++) {
    if (!users[i].active) {
      users.splice(i, 1);
    }
  }
  return users;
}

function deduplicate(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) {
        arr.splice(j, 1);
      }
    }
  }
  return arr;
}

function processItems(items) {
  const results = [];
  items.forEach((item, index) => {
    if (item.valid) {
      results.push(item);
      items[index] = { ...item, processed: true };
    }
  });
  return results;
}
