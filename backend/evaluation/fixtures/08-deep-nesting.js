function processRequest(req) {
  if (req) {
    if (req.body) {
      if (req.body.user) {
        if (req.body.user.email) {
          if (req.body.user.email.includes("@")) {
            if (req.body.user.age) {
              if (req.body.user.age >= 18) {
                return { ok: true, user: req.body.user };
              } else {
                return { ok: false, error: "Too young" };
              }
            } else {
              return { ok: false, error: "No age" };
            }
          } else {
            return { ok: false, error: "Invalid email" };
          }
        } else {
          return { ok: false, error: "No email" };
        }
      } else {
        return { ok: false, error: "No user" };
      }
    } else {
      return { ok: false, error: "No body" };
    }
  } else {
    return { ok: false, error: "No request" };
  }
}
