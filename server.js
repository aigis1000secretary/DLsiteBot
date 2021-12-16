const express = require('express');
const app = express();
let server = null;

app.all('/uptimerobot/', (req, res) => {
   res.write('uptimerobot');
   res.end();
})

let init = () => {
   server = app.listen(process.env.PORT || 3000, () => { console.log("HTTP Server is online!") });
}
let terminate = () => {
   server.close();
}

module.exports = { app, init, terminate };
