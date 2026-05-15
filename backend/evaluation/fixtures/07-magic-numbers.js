function calculatePrice(basePrice, quantity) {
  let price = basePrice * quantity;

  if (quantity > 10) {
    price = price * 0.85;
  }

  if (price > 500) {
    price = price + 12.99;
  } else {
    price = price + 4.99;
  }

  price = price * 1.21;

  if (price > 1000) {
    price = price - 50;
  }

  return Math.round(price * 100) / 100;
}

function isEligible(age, score) {
  return age >= 18 && score >= 65 && score <= 100;
}
