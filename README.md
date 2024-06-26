#### Adding connection to HTTPS
 ``` 
openssl req -x509 -newkey rsa:2048 -keyout keytmp.pem -out cert.pem -days 365;
```
- The line above downloads certificates and permissions inorder to connect using https in browser

#### THE OPTIONS

- The options must have a pass phrase or else a decryption error will br produced
- The passphrase must be the same as the one used to generate the permission files.

```JS
const options = {
    key: fs.readFileSync(path.join(__dirname, "./server/ssl/key.pem"), "utf-8"),
    cert: fs.readFileSync(path.join(__dirname, "./server/ssl/cert.pem"), "utf-8"),
    passphrase: "kanyanyakaddu"
}
```

#### Import socket.io client side inside the clients javascript

```JS
   import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js"
```

- instead of commonjs

#### Changing how to import packages in nodejs (server-side)

- This line below changes default use of require and enables use of import statement in order to get packages
```
 "type": "module",
```

#### In cases (bundling node package capabilities)

- In cases where you wish to use node packages in the client side javascript, it must be bundled first
- Therefore, install watchify and use it to bundle the node packages into files the browser understands

- Thus, in the scripts add the following lines

```JSON
    "scripts": {
        "watch": "watchify public/index.js -o public/bundle.js -v"
    }
```

- Then open another terminal:
``` npm run watch ```

- In the index.js, use the node packages like this

```JS
const io = require("socket.io-client");
const mediasoup = require("mediasoup-client");
```

- Therefore, the following will produce bundle.js which will be put in the index.html

- Make sure to provide the right ip addresses in order to receive the video streams or else they will not be received
  via the connection e.g.,

```JS
const webRtcTransport_options = {
            listenIps: [
                {
                    ip: "172.28.64.1", // Default Switch ip configuration on localhost machine
                    announcedIp: "172.28.64.1" // ip address of local machine that will be used in the browser
                }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        };
```

- After updating the ip addresses the server can be reached on the localhost network as

```JS
https://localhost:3000/sfu/
```

#### Screenshots
- ![screenshot one](https://github.com/busingepius/mediasoup-1-1/blob/main/screenshot/Screenshot_1.png)
- ![screenshot two](https://github.com/busingepius/mediasoup-1-1/blob/main/screenshot/Screenshot_2.png)
