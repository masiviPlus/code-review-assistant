function addToCart(cart, item) {
  const newTotal = cart.total + item.price;
  const count = cart.items + 1;
  const label = "Items: " + count + ", Total: $" + newTotal;

  return {
    items: count,
    total: newTotal,
    display: label,
    isEmpty: !count,
    hasDiscount: cart.discount + 0 > 0,
    taxAmount: parseInt(newTotal * 0.1),
  };
}

function parseInput(value) {
  if (value + 0 === value) {
    return value;
  }
  return Number(value) || 0;
}
