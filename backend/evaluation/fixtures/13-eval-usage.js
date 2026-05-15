function calculate(expression) {
  return eval(expression);
}

function createFunction(body) {
  return new Function("x", "y", body);
}

function runUserScript(script) {
  const result = eval("(" + script + ")");
  return result;
}

function parseConfig(jsonString) {
  return eval("(" + jsonString + ")");
}
