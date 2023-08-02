const express = require("express");
const path = require("path");
const logger = require("morgan");
const compression = require("compression");
const bearerToken = require("express-bearer-token");
const helmet = require("helmet");
const cron = require("node-cron");

const db = require("./utils/db");
const initAdmin = require("./utils/init-admin");
const pingAll = require("./utils/ping");

const authRoutes = require("./routes/auth");
const networkRoutes = require("./routes/network");
const memberRoutes = require("./routes/member");
const controllerRoutes = require("./routes/controller");

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
if (process.env.ZU_DISABLE_AUTH !== "true") {
  app.use(
    bearerToken({
      headerKey: "token",
    })
  );
}

if (process.env.NODE_ENV === "production") {
  console.debug = function () {};
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.ZU_SECURE_HEADERS !== "false"
) {
  app.use(helmet());
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.ZU_SERVE_FRONTEND !== "false"
) {
  app.use(compression());
  app.use(
    ["/app", "/app/*"],
    express.static(path.join(__dirname, "..", "frontend", "build"))
  );
  app.get(["/app/network/*"], function (req, res) {
    res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
  });
  app.get("/", function (req, res) {
    res.redirect("/app");
  });
}

initAdmin().then(function (admin) {
  db.defaults({ users: [admin], networks: [] }).write();
});

if (process.env.ZU_LAST_SEEN_FETCH !== "false") {
  let schedule = process.env.ZU_LAST_SEEN_SCHEDULE || "*/5 * * * *";
  cron.schedule(schedule, () => {
    console.debug("Running scheduled job");
    const networks = db.get("networks").value();
    networks.forEach(async (network) => {
      console.debug("Processing network " + network.id);
      await pingAll(network);
    });
  });
}

const routerAPI = express.Router();
const routerController = express.Router();

routerAPI.use("/network", networkRoutes);
routerAPI.use("/network/:nwid/member", memberRoutes);
routerController.use("", controllerRoutes);

app.use("/auth", authRoutes);
app.use("/api", routerAPI); // offical SaaS API compatible
app.use("/controller", routerController); // other controller-specific routes

// error handlers
app.get("*", async function (req, res) {
  res.status(404).json({ error: "404 Not found" });
});
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({ error: "500 Internal server error" });
});

module.exports = app;
