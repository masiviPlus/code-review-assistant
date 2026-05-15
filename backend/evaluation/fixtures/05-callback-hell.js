const fs = require("fs");

function processFiles() {
  fs.readFile("input.txt", "utf-8", function (err, data) {
    if (err) {
      console.log("Error reading");
    } else {
      fs.readFile("config.txt", "utf-8", function (err2, config) {
        if (err2) {
          console.log("Error reading config");
        } else {
          const result = data + config;
          fs.writeFile("output.txt", result, function (err3) {
            if (err3) {
              console.log("Error writing");
            } else {
              console.log("Done");
              fs.readFile("output.txt", "utf-8", function (err4, verify) {
                if (err4) {
                  console.log("Error verifying");
                } else {
                  console.log("Verified: " + verify.length + " bytes");
                }
              });
            }
          });
        }
      });
    }
  });
}

processFiles();
