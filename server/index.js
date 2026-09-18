const express = require("express");
const cors = require("cors");
const routes = require("./routes");

const app = express();

require("dotenv").config();

app.use(express.json());

app.use(cors({
    origin: "*"
}));

app.use("/api/v1", routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});