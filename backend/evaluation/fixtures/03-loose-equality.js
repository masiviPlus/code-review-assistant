function checkValue(input) {
  if (input == null) {
    return "empty";
  }
  if (input == 0) {
    return "zero";
  }
  if (input == "") {
    return "blank";
  }
  if (input == true) {
    return "truthy";
  }
  return "other";
}

function isAdmin(role) {
  return role == "admin";
}
