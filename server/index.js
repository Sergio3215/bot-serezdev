require("dotenv").config();

const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const {
    assertInternalApiSecretConfigured,
    internalApiAuth,
} = require("./middleware/internalApiAuth");

const app = express();

assertInternalApiSecretConfigured();

app.disable("x-powered-by");

app.use(express.json());

app.use(cors({
    origin: process.env.URL_PERMISSION
}));

app.use("/api/v1", internalApiAuth, routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
