function getDiscount(customer) {
  if (customer.isPremium) {
    return 0.2;
  } else {
    if (customer.orders > 10) {
      return 0.1;
    } else {
      if (customer.orders > 5) {
        return 0.05;
      } else {
        return 0;
      }
    }
  }
}

function validateAge(age) {
  if (age < 0) {
    return { valid: false, error: "Negative age" };
  } else if (age > 150) {
    return { valid: false, error: "Unrealistic age" };
  } else {
    return { valid: true };
  }
}

function getStatus(code) {
  if (code === 200) {
    return "OK";
  } else if (code === 404) {
    return "Not Found";
  } else if (code === 500) {
    return "Server Error";
  } else {
    return "Unknown";
  }
}
